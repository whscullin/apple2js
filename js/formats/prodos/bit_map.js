/* Copyright 2010-2019 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

export function BitMap(volume) {
    var vdh = volume.vdh();
    var blocks = volume.blocks();

    var BLOCK_ENTRIES = 4096;

    function _init() {
    }

    _init();

    return {
        allocBlock: function () {
            for (var idx = 0; idx < vdh.totalBlocks; idx++) {
                var blockOffset = vdh.bitMapPointer + Math.floor(idx / BLOCK_ENTRIES);
                var bitMapBlock = blocks[blockOffset];
                var byteOffset = (idx - blockOffset * BLOCK_ENTRIES) >> 8;
                var bits = bitMapBlock[byteOffset];
                if (bits !== 0xff) {
                    var mask = 0x01;
                    for (var bitOffset = 0; bitOffset < 8; bitOffset++) {
                        if (!(bits & mask)) {
                            bitMapBlock[byteOffset] |= mask;
                            return idx;
                        }
                        mask <<= 1;
                    }
                }
            }
            throw new Error('Disk full');
        },

        freeBlock: function (block) {
            if (block >= vdh.totalBlocks) {
                throw new Error('Block out of range');
            }
            var blockOffset = vdh.bitMapPointer + Math.floor(block / BLOCK_ENTRIES);
            var byteOffset = (block - blockOffset * BLOCK_ENTRIES) >> 8;
            var bitOffset = block & 0x7;

            var bitMapBlock = blocks[blockOffset];

            bitMapBlock[byteOffset] &= 0xff ^ (0x01 << bitOffset);
        }
    };
}
