import type { ProDOSVolume } from '.';
import { BitMap } from './bit_map';
import { BLOCK_SIZE, STORAGE_TYPES } from './constants';
import type { FileEntry } from './file_entry';

export class TreeFile {
    private bitMap: BitMap;
    private blocks: Uint8Array[];

    constructor (volume: ProDOSVolume, private fileEntry: FileEntry) {
        this.blocks = volume.blocks();
        this.bitMap = volume.bitMap();
    }

    getBlockPointers() {
        const treeBlock = this.blocks[this.fileEntry.keyPointer];
        const saplingPointers = new DataView(treeBlock);
        const pointers = [];
        for (let idx = 0; idx < 256; idx++) {
            const saplingPointer = saplingPointers.getUint16(idx * 2);
            if (saplingPointer) {
                pointers.push(saplingPointer);
                const seedlingPointers = new DataView(this.blocks[saplingPointer]);
                for (let jdx = 0; jdx < 256; jdx++) {
                    const seedlingPointer = seedlingPointers.getUint16(idx * 2);
                    if (seedlingPointer) {
                        pointers.push(seedlingPointer);
                    }
                }
            }
        }
        return pointers;
    }

    read() {
        const treeBlock = this.blocks[this.fileEntry.keyPointer];
        const saplingPointers = new DataView(treeBlock);
        let remainingLength = this.fileEntry.eof;
        const data = new Uint8Array(remainingLength);
        let offset = 0;
        let idx = 0;

        while (remainingLength > 0) {
            const saplingPointer = saplingPointers.getUint16(idx * 2, true);
            let jdx = 0;
            if (saplingPointer) {
                const saplingBlock = this.blocks[saplingPointer];
                const seedlingPointers = new DataView(saplingBlock);

                while (jdx < 256 && remainingLength > 0) {
                    const seedlingPointer = seedlingPointers.getUint16(idx * 2, true);
                    if (seedlingPointer) {
                        const seedlingBlock = this.blocks[seedlingPointer];
                        const bytes = seedlingBlock.slice(Math.min(BLOCK_SIZE, remainingLength));

                        data.set(bytes, offset);
                    }
                    jdx++;
                    offset += BLOCK_SIZE;
                    remainingLength -= BLOCK_SIZE;
                }
            } else {
                offset += BLOCK_SIZE * 256;
                remainingLength -= BLOCK_SIZE * 256;
            }
            idx++;
        }
        return data;
    }

    write(data: Uint8Array) {
        this.fileEntry.storageType = STORAGE_TYPES.TREE;
        this.fileEntry.keyPointer = this.bitMap.allocBlock();
        this.fileEntry.eof = data.byteLength;

        const treeBlock = this.blocks[this.fileEntry.keyPointer];
        const saplingPointers = new DataView(treeBlock);

        let remainingLength = this.fileEntry.eof;
        let offset = 0;
        let idx = 0;

        while (remainingLength > 0) {
            const saplingPointer = this.bitMap.allocBlock();
            const saplingBlock = this.blocks[saplingPointer];
            saplingPointers.setUint16(idx * 2, saplingPointer, true);
            const seedlingPointers = new DataView(saplingBlock);

            let jdx = 0;

            while (jdx < 256 && remainingLength > 0) {
                const seedlingPointer = this.bitMap.allocBlock();
                seedlingPointers.setUint16(idx * 2, seedlingPointer, true);
                const seedlingBlock = this.blocks[seedlingPointer];
                seedlingBlock.set(data.slice(offset, Math.min(BLOCK_SIZE, remainingLength)));
                jdx++;
                offset += BLOCK_SIZE;
                remainingLength -= BLOCK_SIZE;
            }
            idx++;
        }
        this.fileEntry.write();
    }

    delete() {
        const pointers = this.getBlockPointers();
        for (let idx = 0; idx < pointers.length; idx++) {
            this.bitMap.freeBlock(pointers[idx]);
        }
    }
}

