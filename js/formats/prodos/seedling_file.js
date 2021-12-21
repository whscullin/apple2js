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

