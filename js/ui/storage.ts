import MicroModal from 'micromodal';
import { includes } from '../types';
import {
    BlockFormat,
    BLOCK_FORMATS,
    DriveNumber,
    NibbleFormat,
    NIBBLE_FORMATS,
    DiskStorage
} from '../formats/types';
import { openAlert } from './alert';
import { initGamepad } from './gamepad';
import {
    loadingProgress,
    loadingStart,
    loadingStop
} from './loader';
import { hup } from './url';
import type { LoadOptions } from './disk2';

export class StorageUI {
    protected currentDrive: DriveNumber = 1;

    constructor(
        private storage: DiskStorage<BlockFormat|NibbleFormat>,
        private formats: typeof NIBBLE_FORMATS | typeof BLOCK_FORMATS) {
    }

    handleDragOver(event: DragEvent) {
        event.preventDefault();
        event.dataTransfer!.dropEffect = 'copy';
    }

    handleDragEnd(event: DragEvent) {
        const dt = event.dataTransfer!;
        if (dt.items) {
            for (let i = 0; i < dt.items.length; i++) {
                dt.items.remove(i);
            }
        } else {
            dt.clearData();
        }
    }

    handleDrop(drive: DriveNumber, event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();

        if (drive < 1) {
            if (!this.storage.getMetadata(1)) {
                drive = 1;
            } else if (!this.storage.getMetadata(2)) {
                drive = 2;
            } else {
                drive = 1;
            }
        }
        const dt = event.dataTransfer!;
        if (dt.files.length == 1) {
            const runOnLoad = event.shiftKey;
            this.doLoadLocal(drive, dt.files[0], { runOnLoad });
        } else if (dt.files.length == 2) {
            this.doLoadLocal(1, dt.files[0]);
            this.doLoadLocal(2, dt.files[1]);
        }
    }

    doLoadLocalDisk(drive: DriveNumber, file: File) {
        loadingStart();
        const fileReader = new FileReader();
        fileReader.onload = () => {
            const result = fileReader.result as ArrayBuffer;
            const parts = file.name.split('.');
            const ext = parts.pop()!.toLowerCase();
            const name = parts.join('.');

            // Remove any json file reference
            const files = hup().split('|');
            files[drive - 1] = '';
            document.location.hash = files.join('|');

            if (includes(this.formats, ext)) {
                if (
                    this.storage.setBinary(drive, name, ext, result)
                ) {
                    initGamepad();
                } else {
                    openAlert(`Unable to load ${name}`);
                }
            }
            loadingStop();
        };
        fileReader.readAsArrayBuffer(file);
    }

    doLoadHTTP(drive: DriveNumber, url?: string) {
        if (!url) {
            MicroModal.close('http-modal');
        }

        loadingStart();
        const input = document.querySelector<HTMLInputElement>('#http_url')!;
        url = url || input.value;
        if (url) {
            fetch(url).then((response) =>{
                if (response.ok) {
                    const reader = response!.body!.getReader();
                    let received = 0;
                    const chunks: Uint8Array[] = [];
                    const contentLength = parseInt(response.headers.get('content-length')!, 10);

                    return reader.read().then(
                        function readChunk(result): Promise<ArrayBufferLike> {
                            if (result.done) {
                                const data = new Uint8Array(received);
                                let offset = 0;
                                for (let idx = 0; idx < chunks.length; idx++) {
                                    data.set(chunks[idx], offset);
                                    offset += chunks[idx].length;
                                }
                                return Promise.resolve(data.buffer);
                            }

                            received += result.value.length;
                            if (contentLength) {
                                loadingProgress(received, contentLength);
                            }
                            chunks.push(result.value);

                            return reader.read().then(readChunk);
                        });
                } else {
                    openAlert('Error loading: ' + response.statusText);
                }
            }).then((data) => {
                const urlParts = url!.split('/');
                const file = urlParts.pop()!;
                const fileParts = file.split('.');
                const ext = fileParts.pop()!.toLowerCase();
                const name = decodeURIComponent(fileParts.join('.'));
                if (includes(this.formats, ext)) {
                    if (data && this.storage.setBinary(drive, name, ext, data)) {
                        initGamepad();
                    } else {
                        openAlert(`Unable to load ${name}`);
                    }
                } else {
                    openAlert('Unknown extension: ' + ext);
                }
                loadingStop();
            }).catch(function (error) {
                loadingStop();
                openAlert(error.message);
            });
        }
    }

    protected doLoadLocal(_drive: DriveNumber, _file: File, _options?: LoadOptions) {
        throw new Error('Unimplemented');
    }

    openLoadHTTP() {
        MicroModal.show('http-modal');
    }
}
