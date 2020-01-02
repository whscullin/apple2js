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
import { STORAGE_TYPES } from './constants';

export function SeedlingFile (volume, fileEntry) {
    var blocks = volume.blocks();
    var bitMap = volume.bitMap();

    return {
        getBlockPointers() {
            var pointers = [fileEntry.keyPointer];
            return pointers;
        },

        read: function () {
            var seedlingBlock = blocks[fileEntry.keyPointer];
            var data = new Uint8Array(fileEntry.eof);
            data.set(seedlingBlock.slice(0, fileEntry.eof));
            return data;
        },

        write: function(data) {
            if (fileEntry.keyPointer) {
                this.delete();
            }
            fileEntry.storageType = STORAGE_TYPES.SEEDLING;
            fileEntry.keyPointer = bitMap.allocBlock();
            fileEntry.eof = data.byteLength;
            var seedlingBlock = blocks[fileEntry.keyPointer];
            seedlingBlock.set(data);
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

