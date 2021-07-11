import MicroModal from 'micromodal';

import { includes } from '../types';
import {
    BlockFormat,
    BLOCK_FORMATS,
    DriveNumber,
    DiskStorage,
} from '../formats/types';
import { openAlert } from './alert';
import { StorageUI } from './storage';

export class BlockStorageUI extends StorageUI {
    constructor(BlockStorage: DiskStorage<BlockFormat>) {
        super(BlockStorage, BLOCK_FORMATS);
    }

    doLoadLocal(drive: DriveNumber, file: File) {
        const parts = file.name.split('.');
        const ext = parts[parts.length - 1].toLowerCase();
        if (includes(BLOCK_FORMATS, ext)) {
            this.doLoadLocalDisk(drive, file);
        } else {
            openAlert('Unknown file type: ' + ext);
        }
    }

    //
    // Mass Storage Load Dialog Methods
    //

    openLoad(driveString: string) {
        const drive = parseInt(driveString, 10) as DriveNumber;
        this.currentDrive = drive;
        MicroModal.show('mass-storage-modal');
    }

    doLoad() {
        MicroModal.close('mass-storage-modal');

        const localFile = document.querySelector<HTMLInputElement>('#mass-storage-file')!;
        const files = localFile.files;
        if (files && files.length == 1) {
            this.doLoadLocal(this.currentDrive, files[0]);
        }
    }
}
