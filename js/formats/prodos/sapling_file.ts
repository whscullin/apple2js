import { ProDOSVolume } from '.';
import type { BitMap } from './bit_map';
import { BLOCK_SIZE, STORAGE_TYPES } from './constants';
import { FileEntry } from './file_entry';
import { ProDOSFile } from './base_file';

export class SaplingFile extends ProDOSFile {
    blocks: Uint8Array[];
    bitMap: BitMap;

    constructor(
        volume: ProDOSVolume,
        private fileEntry: FileEntry
    ) {
        super(volume);
        this.blocks = this.volume.blocks();
        this.bitMap = this.volume.bitMap();
    }

    getBlockPointers() {
        const saplingBlock = this.blocks[this.fileEntry.keyPointer];
        const seedlingPointers = new DataView(saplingBlock.buffer);

        const pointers = [this.fileEntry.keyPointer];
        for (let idx = 0; idx < 256; idx++) {
            const seedlingPointer =
                seedlingPointers.getUint8(idx) |
                (seedlingPointers.getUint8(0x100 + idx) << 8);
            if (seedlingPointer) {
                pointers.push(seedlingPointer);
            }
        }
        return pointers;
    }

    // TODO(whscullin): Why did I not use getBlockPointers for these...
    read() {
        const saplingBlock = this.blocks[this.fileEntry.keyPointer];
        const seedlingPointers = new DataView(saplingBlock.buffer);

        let remainingLength = this.fileEntry.eof;
        const data = new Uint8Array(remainingLength);
        let offset = 0;
        let idx = 0;
        while (remainingLength > 0) {
            const seedlingPointer =
                seedlingPointers.getUint8(idx) |
                (seedlingPointers.getUint8(0x100 + idx) << 8);
            if (seedlingPointer) {
                const seedlingBlock = this.blocks[seedlingPointer];
                const bytes = seedlingBlock.slice(
                    0,
                    Math.min(BLOCK_SIZE, remainingLength)
                );

                data.set(bytes, offset);
            }
            idx++;
            offset += BLOCK_SIZE;
            remainingLength -= BLOCK_SIZE;
        }
        return data;
    }

    write(data: Uint8Array) {
        this.fileEntry.storageType = STORAGE_TYPES.SAPLING;
        this.fileEntry.keyPointer = this.bitMap.allocBlock();
        this.fileEntry.eof = data.byteLength;
        const saplingBlock = this.blocks[this.fileEntry.keyPointer];
        const seedlingPointers = new DataView(saplingBlock.buffer);

        let remainingLength = data.byteLength;
        let offset = 0;
        let idx = 0;

        while (remainingLength > 0) {
            const seedlingPointer = this.bitMap.allocBlock();
            seedlingPointers.setUint8(idx, seedlingPointer & 0xff);
            seedlingPointers.setUint8(0x100 + idx, seedlingPointer >> 8);
            const seedlingBlock = this.blocks[seedlingPointer];
            seedlingBlock.set(
                data.slice(offset, Math.min(BLOCK_SIZE, remainingLength))
            );
            idx++;
            offset += BLOCK_SIZE;
            remainingLength -= BLOCK_SIZE;
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
