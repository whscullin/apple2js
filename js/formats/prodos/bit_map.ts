import { word } from 'js/types';
import { ProDOSVolume } from '.';

const BLOCK_ENTRIES = 4096;

export class BitMap {
    constructor(private volume: ProDOSVolume) {}

    async freeBlocks() {
        const vdh = await this.volume.vdh();
        const free: word[] = [];
        let blockOffset = 0;
        let byteOffset = 0;
        let bitOffset = 0;
        let bitMapBlock = await this.volume
            .disk()
            .read(vdh.bitMapPointer + blockOffset);
        for (let idx = 0; idx < vdh.totalBlocks; idx++) {
            const currentByte = bitMapBlock[byteOffset];
            const mask = 1 << bitOffset;
            if (currentByte & mask) {
                free.push(idx);
            }
            bitOffset += 1;
            if (bitOffset > 7) {
                bitOffset = 0;
                byteOffset += 1;
                if (byteOffset > BLOCK_ENTRIES >> 3) {
                    byteOffset = 0;
                    blockOffset += 1;
                    bitMapBlock = await this.volume
                        .disk()
                        .read(vdh.bitMapPointer + blockOffset);
                }
            }
        }
        return free;
    }

    async allocBlock() {
        const vdh = await this.volume.vdh();
        for (let idx = 0; idx < vdh.totalBlocks; idx++) {
            const blockOffset = Math.floor(idx / BLOCK_ENTRIES);
            const bitMapBlock = await this.volume
                .disk()
                .read(vdh.bitMapPointer + blockOffset);
            const byteOffset = (idx - blockOffset * BLOCK_ENTRIES) >> 8;
            const bits = bitMapBlock[byteOffset];
            if (bits !== 0xff) {
                let mask = 0x01;
                for (let bitOffset = 0; bitOffset < 8; bitOffset++) {
                    if (!(bits & mask)) {
                        bitMapBlock[byteOffset] |= mask;
                        return idx;
                    }
                    mask <<= 1;
                }
            }
        }
        throw new Error('Disk full');
    }

    async freeBlock(block: word) {
        const vdh = await this.volume.vdh();

        if (block >= vdh.totalBlocks) {
            throw new Error('Block out of range');
        }
        const blockOffset = Math.floor(block / BLOCK_ENTRIES);
        const byteOffset = (block - blockOffset * BLOCK_ENTRIES) >> 8;
        const bitOffset = block & 0x7;

        const bitMapBlock = await this.volume
            .disk()
            .read(vdh.bitMapPointer + blockOffset);

        bitMapBlock[byteOffset] &= 0xff ^ (0x01 << bitOffset);
    }
}
