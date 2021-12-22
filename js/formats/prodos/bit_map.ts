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


    allocBlock () {
        for (let idx = 0; idx < this.vdh.totalBlocks; idx++) {
            const blockOffset = this.vdh.bitMapPointer + Math.floor(idx / BLOCK_ENTRIES);
            const bitMapBlock = this.blocks[blockOffset];
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
        const blockOffset = this.vdh.bitMapPointer + Math.floor(block / BLOCK_ENTRIES);
        const byteOffset = (block - blockOffset * BLOCK_ENTRIES) >> 8;
        const bitOffset = block & 0x7;

        const bitMapBlock = this.blocks[blockOffset];

        bitMapBlock[byteOffset] &= 0xff ^ (0x01 << bitOffset);
    }
}
