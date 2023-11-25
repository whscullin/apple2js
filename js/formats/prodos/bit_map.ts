import { word } from 'js/types';
import { ProDOSVolume } from '.';
import type { VDH } from './vdh';

const BLOCK_ENTRIES = 4096;

export class BitMap {
    private vdh: VDH;
    private blocks: Uint8Array[];

    constructor(volume: ProDOSVolume) {
        this.vdh = volume.vdh();
        this.blocks = volume.blocks();
    }

    freeBlocks() {
        const free: word[] = [];
        let blockOffset = 0;
        let byteOffset = 0;
        let bitOffset = 0;
        let bitMapBlock = this.blocks[this.vdh.bitMapPointer + blockOffset];
        for (let idx = 0; idx < this.vdh.totalBlocks; idx++) {
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
                    bitMapBlock =
                        this.blocks[this.vdh.bitMapPointer + blockOffset];
                }
            }
        }
        return free;
    }

    allocBlock() {
        for (let idx = 0; idx < this.vdh.totalBlocks; idx++) {
            const blockOffset = Math.floor(idx / BLOCK_ENTRIES);
            const bitMapBlock =
                this.blocks[this.vdh.bitMapPointer + blockOffset];
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

    freeBlock(block: word) {
        if (block >= this.vdh.totalBlocks) {
            throw new Error('Block out of range');
        }
        const blockOffset = Math.floor(block / BLOCK_ENTRIES);
        const byteOffset = (block - blockOffset * BLOCK_ENTRIES) >> 8;
        const bitOffset = block & 0x7;

        const bitMapBlock = this.blocks[this.vdh.bitMapPointer + blockOffset];

        bitMapBlock[byteOffset] &= 0xff ^ (0x01 << bitOffset);
    }
}
