import type { ProDOSVolume } from '.';
import { BitMap } from './bit_map';
import { STORAGE_TYPES } from './constants';
import { FileEntry } from './file_entry';

export class SeedlingFile {
    blocks: Uint8Array[];
    bitMap: BitMap;

    constructor(volume: ProDOSVolume, private fileEntry: FileEntry) {
        this.blocks = volume.blocks();
        this.bitMap = volume.bitMap();
    }

    getBlockPointers() {
        const pointers = [this.fileEntry.keyPointer];
        return pointers;
    }

    read() {
        const seedlingBlock = this.blocks[this.fileEntry.keyPointer];
        const data = new Uint8Array(this.fileEntry.eof);
        data.set(seedlingBlock.slice(0, this.fileEntry.eof));
        return data;
    }

    write(data: Uint8Array) {
        if (this.fileEntry.keyPointer) {
            this.delete();
        }
        this.fileEntry.storageType = STORAGE_TYPES.SEEDLING;
        this.fileEntry.keyPointer = this.bitMap.allocBlock();
        this.fileEntry.eof = data.byteLength;
        const seedlingBlock = this.blocks[this.fileEntry.keyPointer];
        seedlingBlock.set(data);
        this.fileEntry.write();
    }

    delete() {
        const pointers = this.getBlockPointers();
        for (let idx = 0; idx < pointers.length; idx++) {
            this.bitMap.freeBlock(pointers[idx]);
        }
    }
}

