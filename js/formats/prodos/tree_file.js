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

export function TreeFile (volume, fileEntry) {
    var blocks = volume.blocks();
    var bitMap = volume.bitMap();

    return {
        getBlockPointers() {
            var treeBlock = blocks[fileEntry.keyPointer];
            var saplingPointers = new DataView(treeBlock);
            var pointers = [];
            for (var idx = 0; idx < 256; idx++) {
                var saplingPointer = saplingPointers.getUint16(idx * 2);
                if (saplingPointer) {
                    pointers.push(saplingPointer);
                    var seedlingPointers = new DataView(blocks[saplingPointer]);
                    for (var jdx = 0; jdx < 256; jdx++) {
                        var seedlingPointer = seedlingPointers.getUint16(idx * 2);
                        if (seedlingPointer) {
                            pointers.push(seedlingPointer);
                        }
                    }
                }
            }
            return pointers;
        },

        read: function() {
            var treeBlock = blocks[fileEntry.keyPointer];
            var saplingPointers = new DataView(treeBlock);
            var remainingLength = fileEntry.eof;
            var data = new Uint8Array(remainingLength);
            var offset = 0;
            var idx = 0;

            while (remainingLength > 0) {
                var saplingPointer = saplingPointers.getUint16(idx * 2, true);
                var jdx = 0;
                if (saplingPointer) {
                    var saplingBlock = blocks[saplingPointer];
                    var seedlingPointers = new DataView(saplingBlock);

                    while (jdx < 256 && remainingLength > 0) {
                        var seedlingPointer = seedlingPointers.getUint16(idx * 2, true);
                        if (seedlingPointer) {
                            var seedlingBlock = blocks[seedlingPointer];
                            var bytes = seedlingBlock.slice(Math.min(BLOCK_SIZE, remainingLength));

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
        },

        write: function(data) {
            fileEntry.storageType = STORAGE_TYPES.TREE;
            fileEntry.keyPointer = bitMap.allocBlock();
            fileEntry.eof = data.byteLength;

            var treeBlock = blocks[fileEntry.keyPointer];
            var saplingPointers = new DataView(treeBlock);

            var remainingLength = fileEntry.eof;
            var offset = 0;
            var idx = 0;

            while (remainingLength > 0) {
                var saplingPointer = bitMap.allocBlock();
                var saplingBlock = blocks[saplingPointer];
                saplingPointers.setUint16(idx * 2, saplingPointer, true);
                var seedlingPointers = new DataView(saplingBlock);

                var jdx = 0;

                while (jdx < 256 && remainingLength > 0) {
                    var seedlingPointer = bitMap.allocBlock();
                    seedlingPointers.setUint16(idx * 2, seedlingPointer, true);
                    var seedlingBlock = blocks[seedlingPointer];
                    seedlingBlock.set(data.slice(offset, Math.min(BLOCK_SIZE, remainingLength)));
                    jdx++;
                    offset += BLOCK_SIZE;
                    remainingLength -= BLOCK_SIZE;
                }
                idx++;
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
