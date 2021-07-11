import MicroModal from 'micromodal';
import { includes, word } from '../types';
import {
    DISK_FORMATS,
    DriveNumber,
    DRIVE_NUMBERS,
    JSONDisk,
    NIBBLE_FORMATS,
} from '../formats/types';
import Tape, { TAPE_TYPES } from './tape';
import DiskII from 'js/cards/disk2';
import CPU6502 from 'js/cpu6502';
import { openAlert } from './alert';
import { initGamepad } from './gamepad';
import {
    loadingStart,
    loadingStop
} from './loader';
import { StorageUI } from './storage';
import { hup } from './url';

const CIDERPRESS_EXTENSION = /#([0-9a-f]{2})([0-9a-f]{4})$/i;
const BIN_TYPES = ['bin'];

const KNOWN_FILE_TYPES = [
    ...DISK_FORMATS,
    ...TAPE_TYPES,
    ...BIN_TYPES,
] as readonly string[];

export interface LoadOptions {
    address?: word,
    runOnLoad?: boolean,
}

type LocalDiskIndex = {
    [name: string]: string,
}

interface DiskDescriptor {
    name: string;
    disk?: number;
    filename: string;
    e?: boolean;
    category: string;
}

type DiskCollection = {
    [name: string]: DiskDescriptor[]
};

declare global {
    interface Window {
        disk_index: DiskDescriptor[];
    }
}

export class Disk2UI extends StorageUI {
    currentDrive: DriveNumber = 1;

    disk_sets: DiskCollection = {};
    disk_categories: DiskCollection = { 'Local Saves': [] };
    // Disk names
    disk_cur_name: string[] = [];
    // Disk categories
    disk_cur_cat: string[] = [];

    constructor(
        private cpu: CPU6502,
        private disk2: DiskII,
        private tape: Tape,
        private e: boolean,
    ) {
        super(disk2, NIBBLE_FORMATS);
        this.buildDiskIndex();

        document.querySelector<HTMLInputElement>('#local_file')?.addEventListener(
            'change',
            (event: Event) => {
                const target = event.target as HTMLInputElement;
                const address = document.querySelector<HTMLInputElement>('#local_file_address_input')!;
                const parts = target.value.split('.');
                const ext = parts[parts.length - 1];

                if (KNOWN_FILE_TYPES.includes(ext)) {
                    address.style.display = 'none';
                } else {
                    address.style.display = 'inline-block';
                }
            }
        );
    }

    doLoadLocal(drive: DriveNumber, file: File, options: LoadOptions = {}) {
        const parts = file.name.split('.');
        const ext = parts[parts.length - 1].toLowerCase();
        const matches = file.name.match(CIDERPRESS_EXTENSION);
        let type, aux;
        if (matches && matches.length === 3) {
            [, type, aux] = matches;
        }
        if (includes(DISK_FORMATS, ext)) {
            this.doLoadLocalDisk(drive, file);
        } else if (includes(TAPE_TYPES, ext)) {
            this.tape.doLoadLocalTape(file);
        } else if (BIN_TYPES.includes(ext) || type === '06' || options.address) {
            const address = aux !== undefined ? parseInt(aux, 16) : undefined;
            this.doLoadBinary(file, { address, ...options });
        } else {
            const addressInput = document.querySelector<HTMLInputElement>('#local_file_address');
            const addressStr = addressInput?.value;
            if (addressStr) {
                const address = parseInt(addressStr, 16);
                if (isNaN(address)) {
                    openAlert('Invalid address: ' + addressStr);
                    return;
                }
                this.doLoadBinary(file, { address, ...options });
            } else {
                openAlert('Unknown file type: ' + ext);
            }
        }
    }

    doLoadBinary(file: File, options: LoadOptions) {
        loadingStart();

        const fileReader = new FileReader();
        fileReader.onload = () => {
            const result = fileReader.result as ArrayBuffer;
            let { address } = options;
            address = address ?? 0x2000;
            const bytes = new Uint8Array(result);
            for (let idx = 0; idx < result.byteLength; idx++) {
                this.cpu.write(address >> 8, address & 0xff, bytes[idx]);
                address++;
            }
            if (options.runOnLoad) {
                this.cpu.reset();
                this.cpu.setPC(address);
            }
            loadingStop();
        };
        fileReader.readAsArrayBuffer(file);
    }

    //
    // Disk II Save Methods
    //

    openSave(drive: DriveNumber, event: MouseEvent) {
        const mimeType = 'application/octet-stream';
        const data = this.disk2.getBinary(drive);
        const { name } = this.disk2.getMetadata(drive);
        const a = document.querySelector<HTMLAnchorElement>('#local_save_link')!;

        if (!data) {
            alert('No data from drive ' + drive);
            return;
        }

        const blob = new Blob([data], { 'type': mimeType });
        a.href = window.URL.createObjectURL(blob);
        a.download = name + '.dsk';

        if (event.metaKey) {
            this.dumpDisk(drive);
        } else {
            const saveName = document.querySelector<HTMLInputElement>('#save_name')!;
            saveName.value = name;
            MicroModal.show('save-modal');
        }
    }

    private dumpDisk(drive: DriveNumber) {
        const { name } = this.disk2.getMetadata(drive);
        const wind = window.open('', '_blank')!;
        wind.document.title = name;
        wind.document.write('<pre>');
        wind.document.write(this.disk2.getJSON(drive, true));
        wind.document.write('</pre>');
        wind.document.close();
    }

    //
    // Disk II Load Dialog Methods
    //

    openLoad(drive: DriveNumber, event: MouseEvent) {
        this.currentDrive = drive;
        if (event.metaKey && includes(DRIVE_NUMBERS, drive)) {
            this.openLoadHTTP();
        } else {
            if (this.disk_cur_cat[drive]) {
                const element = document.querySelector<HTMLSelectElement>('#category_select')!;
                element.value = this.disk_cur_cat[drive];
                this.selectCategory();
            }
            MicroModal.show('load-modal');
        }
    }

    selectCategory() {
        const diskSelect = document.querySelector<HTMLSelectElement>('#disk_select')!;
        const categorySelect = document.querySelector<HTMLSelectElement>('#category_select')!;
        diskSelect.innerHTML = '';
        const cat = this.disk_categories[categorySelect.value];
        if (cat) {
            for (let idx = 0; idx < cat.length; idx++) {
                const file = cat[idx];
                let name = file.name;
                if (file.disk) {
                    name += ' - ' + file.disk;
                }
                const option = document.createElement('option');
                option.value = file.filename;
                option.innerText = name;
                diskSelect.append(option);
                if (this.disk_cur_name[this.currentDrive] === name) {
                    option.selected = true;
                }
            }
        }
    }

    /** Called to load disks from the local catalog. */
    loadDisk(drive: DriveNumber, disk: JSONDisk) {
        let name = disk.name;
        const category = disk.category!; // all disks in the local catalog have a category

        if (disk.disk) {
            name += ' - ' + disk.disk;
        }

        this.disk_cur_cat[drive] = category;
        this.disk_cur_name[drive] = name;

        this.disk2.setDisk(drive, disk);
        initGamepad(disk.gamepad);
    }

    clickDisk(event: MouseEvent|KeyboardEvent) {
        this.doLoad(event);
    }

    doLoad(event: MouseEvent|KeyboardEvent) {
        MicroModal.close('load-modal');
        const select = document.querySelector<HTMLSelectElement>('#disk_select')!;
        const urls = select.value;
        let url;
        if (urls && urls.length) {
            if (typeof (urls) == 'string') {
                url = urls;
            } else {
                url = urls[0];
            }
        }

        const localFile = document.querySelector<HTMLInputElement>('#local_file')!;
        const files = localFile.files;
        if (files && files.length == 1) {
            const runOnLoad = event.shiftKey;
            this.doLoadLocal(this.currentDrive, files[0], { runOnLoad });
        } else if (url) {
            let filename;
            MicroModal.close('load-modal');
            if (url.substr(0, 6) == 'local:') {
                filename = url.substr(6);
                if (filename == '__manage') {
                    this.openManage();
                } else {
                    this.loadLocalStorage(this.currentDrive, filename);
                }
            } else {
                const r1 = /json\/disks\/(.*).json$/.exec(url);
                if (r1) {
                    filename = r1[1];
                } else {
                    filename = url;
                }
                const parts = hup().split('|');
                parts[this.currentDrive - 1] = filename;
                document.location.hash = parts.join('|');
            }
        }
    }

    //
    // Local Storage methods
    //

    doSave() {
        const saveName = document.querySelector<HTMLInputElement>('#save_name')!;
        const name = saveName.value;
        this.saveLocalStorage(this.currentDrive, name);
        MicroModal.close('save-modal');
        window.setTimeout(() => openAlert('Saved'), 0);
    }

    doDelete(name: string) {
        if (window.confirm('Delete ' + name + '?')) {
            this.deleteLocalStorage(name);
        }
    }

    openManage() {
        MicroModal.show('manage-modal');
    }

    private saveLocalStorage(drive: DriveNumber, name: string) {
        const diskIndex = JSON.parse(window.localStorage.diskIndex || '{}') as LocalDiskIndex;

        const json = this.disk2.getJSON(drive);
        diskIndex[name] = json;

        window.localStorage.diskIndex = JSON.stringify(diskIndex);

        this.updateLocalStorage();
    }

    private deleteLocalStorage(name: string) {
        const diskIndex = JSON.parse(window.localStorage.diskIndex || '{}') as LocalDiskIndex;
        if (diskIndex[name]) {
            delete diskIndex[name];
            openAlert('Deleted');
        }
        window.localStorage.diskIndex = JSON.stringify(diskIndex);
        this.updateLocalStorage();
    }

    private loadLocalStorage(drive: DriveNumber, name: string) {
        const diskIndex = JSON.parse(window.localStorage.diskIndex || '{}') as LocalDiskIndex;
        if (diskIndex[name]) {
            this.disk2.setJSON(drive, diskIndex[name]);
        }
    }

    private updateLocalStorage() {
        const diskIndex = JSON.parse(window.localStorage.diskIndex || '{}');
        const names = Object.keys(diskIndex);

        const cat: DiskDescriptor[] = this.disk_categories['Local Saves'] = [];
        const contentDiv = document.querySelector<HTMLDivElement>('#manage-modal-content')!;
        contentDiv.innerHTML = '';

        names.forEach(function (name) {
            cat.push({
                'category': 'Local Saves',
                'name': name,
                'filename': 'local:' + name
            });
            contentDiv.innerHTML =
                '<span class="local_save">' +
                name +
                ' <a href="#" onclick="Apple2.doDelete(\'' +
                name +
                '\')">Delete</a><br /></span>';
        });
        cat.push({
            'category': 'Local Saves',
            'name': 'Manage Saves...',
            'filename': 'local:__manage'
        });
    }

    //
    // Disk II Modal
    //

    private buildDiskIndex() {
        const categorySelect = document.querySelector<HTMLSelectElement>('#category_select')!;

        let oldCat = '';
        let option;
        for (let idx = 0; idx < window.disk_index.length; idx++) {
            const file = window.disk_index[idx];
            const cat = file.category;
            const name = file.name;
            const disk = file.disk;
            if (file.e && !this.e) {
                continue;
            }
            if (cat != oldCat) {
                option = document.createElement('option');
                option.value = cat;
                option.innerText = cat;
                categorySelect.append(option);

                this.disk_categories[cat] = [];
                oldCat = cat;
            }
            this.disk_categories[cat].push(file);
            if (disk) {
                if (!this.disk_sets[name]) {
                    this.disk_sets[name] = [];
                }
                this.disk_sets[name].push(file);
            }
        }
        option = document.createElement('option');
        option.innerText = 'Local Saves';
        categorySelect.append(option);

        this.updateLocalStorage();
    }

    //
    // JSON loading
    //

    loadAjax(drive: DriveNumber, url: string) {
        loadingStart();

        fetch(url).then(function (response: Response) {
            loadingStop();
            if (response.ok && response.status == 200) {
                return response.json();
            } else {
                openAlert('Error loading: ' + response.statusText);
            }
        }).then((data: JSONDisk | undefined) => {
            if (data) {
                if (includes(DISK_FORMATS, data.type)) {
                    this.loadDisk(drive, data);
                }
                initGamepad(data.gamepad);
            }
        }).catch(function (error) {
            loadingStop();
            openAlert(error.message);
        });
    }

    selectDisk() {
        const localFile = document.querySelector<HTMLInputElement>('#local_file')!;
        localFile.value = '';
    }
}
