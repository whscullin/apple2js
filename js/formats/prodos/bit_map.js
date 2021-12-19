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
