import type { ProDOSVolume } from '.';
import { ProDOSFile } from './base_file';
import { STORAGE_TYPES } from './constants';
import { FileEntry } from './file_entry';

export class SeedlingFile extends ProDOSFile {
    constructor(
        volume: ProDOSVolume,
        private fileEntry: FileEntry
    ) {
        super(volume);
    }

    getBlockPointers() {
        const pointers = [this.fileEntry.keyPointer];
        return pointers;
    }

    async read() {
        const seedlingBlock = await this.volume
            .disk()
            .read(this.fileEntry.keyPointer);
        const data = new Uint8Array(this.fileEntry.eof);
        data.set(seedlingBlock.slice(0, this.fileEntry.eof));
        return data;
    }

    async write(data: Uint8Array) {
        const bitMap = await this.volume.bitMap();
        if (this.fileEntry.keyPointer) {
            await this.delete();
        }
        this.fileEntry.storageType = STORAGE_TYPES.SEEDLING;
        this.fileEntry.keyPointer = await bitMap.allocBlock();
        this.fileEntry.eof = data.byteLength;
        const seedlingBlock = await this.volume
            .disk()
            .read(this.fileEntry.keyPointer);
        seedlingBlock.set(data);
        this.fileEntry.write();
    }

    async delete() {
        const bitMap = await this.volume.bitMap();
        const pointers = this.getBlockPointers();
        for (let idx = 0; idx < pointers.length; idx++) {
            await bitMap.freeBlock(pointers[idx]);
        }
    }
}
