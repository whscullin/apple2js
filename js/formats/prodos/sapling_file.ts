import { ProDOSVolume } from '.';
import { BLOCK_SIZE, STORAGE_TYPES } from './constants';
import { FileEntry } from './file_entry';
import { ProDOSFile } from './base_file';

export class SaplingFile extends ProDOSFile {
    constructor(
        volume: ProDOSVolume,
        private fileEntry: FileEntry
    ) {
        super(volume);
    }

    async getBlockPointers() {
        const saplingBlock = await this.volume
            .disk()
            .read(this.fileEntry.keyPointer);
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
    async read() {
        const saplingBlock = await this.volume
            .disk()
            .read(this.fileEntry.keyPointer);
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
                const seedlingBlock = await this.volume
                    .disk()
                    .read(seedlingPointer);
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

    async write(data: Uint8Array) {
        const bitMap = await this.volume.bitMap();
        this.fileEntry.storageType = STORAGE_TYPES.SAPLING;
        this.fileEntry.keyPointer = await bitMap.allocBlock();
        this.fileEntry.eof = data.byteLength;
        const saplingBlock = await this.volume
            .disk()
            .read(this.fileEntry.keyPointer);
        const seedlingPointers = new DataView(saplingBlock.buffer);

        let remainingLength = data.byteLength;
        let offset = 0;
        let idx = 0;

        while (remainingLength > 0) {
            const seedlingPointer = await bitMap.allocBlock();
            seedlingPointers.setUint8(idx, seedlingPointer & 0xff);
            seedlingPointers.setUint8(0x100 + idx, seedlingPointer >> 8);
            const seedlingBlock = await this.volume
                .disk()
                .read(seedlingPointer);
            seedlingBlock.set(
                data.slice(offset, Math.min(BLOCK_SIZE, remainingLength))
            );
            idx++;
            offset += BLOCK_SIZE;
            remainingLength -= BLOCK_SIZE;
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
