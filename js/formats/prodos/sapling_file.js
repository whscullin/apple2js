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

import { BLOCK_SIZE, STORAGE_TYPES } from './constants';

export function SaplingFile (volume, fileEntry) {
    var blocks = volume.blocks();
    var bitMap = volume.bitMap();

    return {
        getBlockPointers() {
            var saplingBlock = blocks[fileEntry.keyPointer];
            var seedlingPointers = new DataView(saplingBlock);

            var pointers = [fileEntry.keyPointer];
            for (var idx = 0; idx < 256; idx++) {
                var seedlingPointer = seedlingPointers.getUint16(idx * 2);
                if (seedlingPointer) {
                    pointers.push(seedlingPointer);
                }
            }
            return pointers;
        },

        read: function() {
            var saplingBlock = blocks[fileEntry.keyPointer];
            var seedlingPointers = new DataView(saplingBlock);

            var remainingLength = fileEntry.oef;
            var data = new Uint8Array(remainingLength);
            var offset = 0;
            var idx = 0;
            while (remainingLength > 0) {
                var seedlingPointer = seedlingPointers.getUint16(idx * 2);
                if (seedlingPointer) {
                    var seedlingBlock = blocks[seedlingPointer];
                    var bytes = seedlingBlock.slice(0, Math.min(BLOCK_SIZE, remainingLength));

                    data.set(bytes, offset);
                }
                idx++;
                offset += BLOCK_SIZE;
                remainingLength -= BLOCK_SIZE;
            }
            return data;
        },

        write: function(data) {
            fileEntry.storageType = STORAGE_TYPES.SAPLING;
            fileEntry.keyPointer = bitMap.allocBlock();
            fileEntry.eof = data.byteLength;
            var saplingBlock = blocks[fileEntry.keyPointer];
            var seedlingPointers = new DataView(saplingBlock);

            var remainingLength = data.byteLength;
            var offset = 0;
            var idx = 0;

            while (remainingLength > 0) {
                var seedlingPointer = bitMap.allocBlock();
                seedlingPointers.setUint16(idx * 2, seedlingPointer, true);
                var seedlingBlock = blocks[seedlingPointer];
                seedlingBlock.set(data.slice(offset, Math.min(BLOCK_SIZE, remainingLength)));
                idx++;
                offset += BLOCK_SIZE;
                remainingLength -= BLOCK_SIZE;
            }
            fileEntry.write();
        },

        delete: function() {
            var pointers = this.getBlockPointers();
            for (var idx; idx < pointers.length; idx++) {
                bitMap.freeBlock(pointers[idx]);
            }
        }
    };
}

