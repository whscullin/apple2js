import type { ProDOSVolume } from '.';
import { ProDOSFile } from './base_file';
import { BLOCK_SIZE, STORAGE_TYPES } from './constants';
import type { FileEntry } from './file_entry';

export class TreeFile extends ProDOSFile {
    constructor(
        volume: ProDOSVolume,
        private fileEntry: FileEntry
    ) {
        super(volume);
    }

    async getBlockPointers() {
        const treeBlock = await this.volume
            .disk()
            .read(this.fileEntry.keyPointer);
        const saplingPointers = new DataView(treeBlock.buffer);
        const pointers = [];
        for (let idx = 0; idx < 256; idx++) {
            const saplingPointer =
                saplingPointers.getUint8(idx) |
                (saplingPointers.getUint8(0x100 + idx) << 8);
            if (saplingPointer) {
                pointers.push(saplingPointer);
                const readBlock = await this.volume.disk().read(saplingPointer);
                const seedlingPointers = new DataView(readBlock.buffer);
                for (let jdx = 0; jdx < 256; jdx++) {
                    const seedlingPointer =
                        seedlingPointers.getUint8(idx) |
                        (seedlingPointers.getUint8(0x100 + idx) << 8);
                    if (seedlingPointer) {
                        pointers.push(seedlingPointer);
                    }
                }
            }
        }
        return pointers;
    }

    // TODO(whscullin): Why did I not use getBlockPointers for these...
    async read() {
        const treeBlock = await this.volume
            .disk()
            .read(this.fileEntry.keyPointer);
        const saplingPointers = new DataView(treeBlock.buffer);
        let remainingLength = this.fileEntry.eof;
        const data = new Uint8Array(remainingLength);
        let offset = 0;
        let idx = 0;

        while (remainingLength > 0) {
            const saplingPointer =
                saplingPointers.getUint8(idx) |
                (saplingPointers.getUint8(0x100 + idx) << 8);
            let jdx = 0;
            if (saplingPointer) {
                const saplingBlock = await this.volume
                    .disk()
                    .read(saplingPointer);
                const seedlingPointers = new DataView(saplingBlock.buffer);

                while (jdx < 256 && remainingLength > 0) {
                    const seedlingPointer =
                        seedlingPointers.getUint8(idx) |
                        (seedlingPointers.getUint8(0x100 + idx) << 8);
                    if (seedlingPointer) {
                        const seedlingBlock = await this.volume
                            .disk()
                            .read(seedlingPointer);
                        const bytes = seedlingBlock.slice(
                            Math.min(BLOCK_SIZE, remainingLength)
                        );

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

    async write(data: Uint8Array) {
        const bitMap = await this.volume.bitMap();
        this.fileEntry.storageType = STORAGE_TYPES.TREE;
        this.fileEntry.keyPointer = await bitMap.allocBlock();
        this.fileEntry.eof = data.byteLength;

        const treeBlock = await this.volume
            .disk()
            .read(this.fileEntry.keyPointer);
        const saplingPointers = new DataView(treeBlock.buffer);

        let remainingLength = this.fileEntry.eof;
        let offset = 0;
        let idx = 0;

        while (remainingLength > 0) {
            const saplingPointer = await bitMap.allocBlock();
            const saplingBlock = await this.volume.disk().read(saplingPointer);
            saplingPointers.setUint8(idx, saplingPointer & 0xff);
            saplingPointers.setUint8(0x100 + idx, saplingPointer >> 8);
            const seedlingPointers = new DataView(saplingBlock.buffer);

            let jdx = 0;

            while (jdx < 256 && remainingLength > 0) {
                const seedlingPointer = await bitMap.allocBlock();
                seedlingPointers.setUint8(idx, seedlingPointer & 0xff);
                seedlingPointers.setUint8(0x100 + idx, seedlingPointer >> 8);
                const seedlingBlock = await this.volume
                    .disk()
                    .read(seedlingPointer);
                seedlingBlock.set(
                    data.slice(offset, Math.min(BLOCK_SIZE, remainingLength))
                );
                jdx++;
                offset += BLOCK_SIZE;
                remainingLength -= BLOCK_SIZE;
            }
            idx++;
        }
        this.fileEntry.write();
    }

    async delete() {
        const bitMap = await this.volume.bitMap();
        const pointers = await this.getBlockPointers();
        for (let idx = 0; idx < pointers.length; idx++) {
            await bitMap.freeBlock(pointers[idx]);
        }
    }
}
