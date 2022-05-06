import { includes } from 'js/types';
import { initGamepad } from 'js/ui/gamepad';
import {
    DISK_FORMATS,
    DriveNumber,
    JSONDisk,
    NIBBLE_FORMATS
} from 'js/formats/types';
import DiskII from 'js/cards/disk2';

/**
 * Routine to split a legacy hash into parts for disk loading
 *
 * @returns an padded array for 1 based indexing
 */

export const getHashParts = () => {
    const parts = window.location.hash.match(/^#([^|]*)\|?(.*)$/) || ['', '', ''];
    return ['', parts[1], parts[2]];
};

/**
 * Update the location hash to reflect the current disk state, if possible
 *
 * @param parts a padded array with values starting at index 1
 */

export const setHashParts = (parts: string[]) => {
    window.location.hash = `#${parts[1]}` + (parts[2] ? `|${parts[2]}` : '');
};

/**
 * Local file loading routine. Allows a File object from a file
 * selection form element to be loaded.
 *
 * @param disk2 Disk2 object
 * @param number Drive number
 * @param file Browser File object to load
 * @returns true if successful
 */

export const loadLocalFile = async (
    disk2: DiskII,
    number: DriveNumber,
    file: File,
) => {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = function () {
            const result = this.result as ArrayBuffer;
            const parts = file.name.split('.');
            const ext = parts.pop()!.toLowerCase();
            const name = parts.join('.');

            if (includes(DISK_FORMATS, ext)) {
                if (result.byteLength >= 800 * 1024) {
                    reject(`Unable to load ${name}`);
                } else {
                    if (
                        includes(NIBBLE_FORMATS, ext) &&
                        disk2?.setBinary(number, name, ext, result)
                    ) {
                        initGamepad();
                    } else {
                        reject(`Unable to load ${name}`);
                    }
                }
            }
            resolve(true);
        };
        fileReader.readAsArrayBuffer(file);
    });
};

/**
 * JSON loading routine, loads a JSON file at the given URL. Requires
 * proper cross domain loading headers if the URL is not on the same server
 * as the emulator.
 *
 * @param disk2 Disk2 object
 * @param number Drive number
 * @param url URL, relative or absolute to JSON file
 * @returns true if successful
 */

export const loadJSON = async (disk2: DiskII, number: DriveNumber, url: string) => {
    return new Promise((resolve, reject) => {
        fetch(url).then(function (response: Response) {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Error loading: ' + response.statusText);
            }
        }).then(function (data: JSONDisk) {
            if (includes(DISK_FORMATS, data.type)) {
                disk2.setDisk(number, data);
            }
            initGamepad(data.gamepad);
            resolve(true);
        }).catch(function (error) {
            reject(error.message);
        });
    });
};

/**
 * HTTP loading routine, loads a file at the given URL. Requires
 * proper cross domain loading headers if the URL is not on the same server
 * as the emulator. Only supports nibble based formats at the moment.
 *
 * @param disk2 Disk2 object
 * @param number Drive number
 * @param url URL, relative or absolute to JSON file
 * @returns true if successful
 */

export const loadHttpFile = async (
    disk2: DiskII,
    number: DriveNumber,
    url: string,
) => {
    if (url.endsWith('.json')) {
        return loadJSON(disk2, number, url);
    } else {
        return new Promise((resolve, reject) => {
            fetch(url).then(function (response: Response) {
                if (response.ok) {
                    const reader = response!.body!.getReader();
                    let received = 0;
                    const chunks: Uint8Array[] = [];
                    // const contentLength = parseInt(response.headers.get('content-length')!, 10);

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
                            // if (contentLength) {
                            //     loadingProgress(received, contentLength);
                            // }
                            chunks.push(result.value);

                            return reader.read().then(readChunk);
                        });
                } else {
                    reject('Error loading: ' + response.statusText);
                }
            }).then(function (data: ArrayBufferLike) {
                const urlParts = url!.split('/');
                const file = urlParts.pop()!;
                const fileParts = file.split('.');
                const ext = fileParts.pop()!.toLowerCase();
                const name = decodeURIComponent(fileParts.join('.'));
                if (data.byteLength >= 800 * 1024) {
                    reject(`Unable to load ${url}`);
                } else if (
                    includes(NIBBLE_FORMATS, ext) &&
                    disk2.setBinary(number, name, ext, data)
                ) {
                    initGamepad();
                } else {
                    reject(`Extension ${ext} not recognized.`);
                }
                resolve(true);
            }).catch(reject);
        });
    }
};
