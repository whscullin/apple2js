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


export var STORAGE_TYPES = {
    DELETED: 0x0,
    SEEDLING: 0x1,
    SAPLING: 0x2,
    TREE: 0x3,
    DIRECTORY: 0xD,
    SUBDIRECTORY_HEADER: 0xE,
    VDH_HEADER: 0xF
};

export var ACCESS_TYPES = {
    DELETE: 0x80,
    RENAME: 0x40,
    BACKUP: 0x20,
    WRITE: 0x02,
    READ: 0x01
};

export var FILE_TYPES = {
    0x00: 'UNK', // Typeless file (SOS and ProDOS)
    0x01: 'BAD', // Bad block file
    0x02: 'PDC', // Pascal code file
    0x03: 'PTX', // Pascal text file
    0x04: 'TXT', // ASCII text file (SOS and ProDOS)
    0x05: 'PDA', // Pascal data file
    0x06: 'BIN', // General binary file (SOS and ProDOS)
    0x07: 'FNT', // Font file
    0x08: 'FOT', // Graphics screen file
    0x09: 'BA3', // Business BASIC program file
    0x0A: 'DA3', // Business BASIC data file
    0x0B: 'WPF', // Word Processor file
    0x0C: 'SOS', // SOS system file
    0x0F: 'DIR', // Directory file (SOS and ProDOS)
    0x10: 'RPD', // RPS data file
    0x11: 'RPI', // RPS index file
    0x12: 'AFD', // AppleFile discard file
    0x13: 'AFM', // AppleFile model file
    0x14: 'ARF', // AppleFile report format file
    0x15: 'SCL', // Screen Library file
    0x19: 'ADB', // AppleWorks Data Base file
    0x1A: 'AWP', // AppleWorks Word Processor file
    0x1B: 'ASP', // AppleWorks Spreadsheet file
    0xEF: 'PAR', // Pascal area
    0xF0: 'CMD', // ProDOS CI added command file
    0xFA: 'INT', // Integer BASIC program file
    0xFB: 'IVR', // Integer BASIC variable file
    0xFC: 'BAS', // Applesoft program file
    0xFD: 'VAR', // Applesoft variables file
    0xFE: 'REL', // Relocatable code file (EDASM)
    0xFF: 'SYS'  // ProDOS system file
};

export default function ProDOS(disk) {
    var VDH_BLOCK = 2;

    var VDH_OFFSETS = {
        PREV: 0x00,
        NEXT: 0x02,
        STORAGE_TYPE: 0x04,
        NAME_LENGTH: 0x04,
        VOLUME_NAME: 0x05,
        RESERVED_1: 0x14,
        CASE_BITS: 0x1A,
        CREATION: 0x1C, // yyyyyy m|mmmm ddddd|000hhhhh|00mmmmmm
        VERSION: 0x20,
        MIN_VERSION: 0x21,
        ACCESS: 0x22, // $80 Format $40 rename, $20 changed, $02 write , $01 read
        ENTRY_LENGTH: 0x23,
        ENTRIES_PER_BLOCK: 0x24,
        FILE_COUNT: 0x25,
        BIT_MAP_POINTER: 0x27,
        TOTAL_BLOCKS: 0x29,
    };

    var HEADER_OFFSETS = {
        PREV: 0x00,
        NEXT: 0x02,
        STORAGE_TYPE: 0x04,
        NAME_LENGTH: 0x04,
        VOLUME_NAME: 0x05,
        RESERVED_1: 0x14,
        CREATION: 0x1C, // yyyyyy m|mmmm ddddd|000hhhhh|00mmmmmm
        VERSION: 0x20,
        MIN_VERSION: 0x21,
        ACCESS: 0x22, // $80 Format $40 rename, $20 changed, $02 write , $01 read
        ENTRY_LENGTH: 0x23,
        ENTRIES_PER_BLOCK: 0x24,
        FILE_COUNT: 0x25,
        PARENT: 0x27,
        PARENT_ENTRY_NUMBER: 0x29,
        PARENT_ENTRY_LENGTH: 0x2A
    };


    var ENTRY_OFFSETS = {
        STORAGE_TYPE: 0x00,
        NAME_LENGTH: 0x00,
        FILE_NAME: 0x01,
        FILE_TYPE: 0x10,
        KEY_POINTER: 0x11,
        BLOCKS_USED: 0x13,
        EOF: 0x15,
        CREATION: 0x18, // yyyyyyy m|mmmm ddddd|000hhhhh|00mmmmmm
        CASE_BITS: 0x1C,
        VERSION: 0x1C,
        MIN_VERSION: 0x1D,
        ACCESS: 0x1E, // $80 delete $40 rename, $20 changed, $02 write , $01 read
        AUX_TYPE: 0x1F,
        LAST_MOD: 0x21, // yyyyyyy m|mmmm ddddd|000hhhhh|00mmmmmm
        HEADER_POINTER: 0x2E
    };

    var _disk = disk;

    function uint32ToDate(val) {
        if (val) {
            var date = val & 0xffff;
            var time = val >> 16;

            var year = date >> 9;
            var month = (date & 0x01E0) >> 5;
            var day = date & 0x001F;

            var hour = time >> 8;
            var min = time & 0xff;

            return new Date(1900 + year, month - 1, day, hour, min);
        }
        return null;
    }

    function readFileName(block, offset, nameLength, caseBits) {
        var name = '';
        if (!(caseBits & 0x8000)) {
            caseBits = 0;
        }
        for (var idx = 0; idx < nameLength; idx++) {
            caseBits <<= 1;
            var char = String.fromCharCode(block.getUint8(offset + idx));
            name += caseBits & 0x8000 ? char.toLowerCase() : char;
        }
        return name;
    }

    function readEntry(block, offset) {
        var storageType = block.getUint8(offset + ENTRY_OFFSETS.STORAGE_TYPE) >> 4;
        var nameLength = block.getUint8(offset + ENTRY_OFFSETS.NAME_LENGTH) & 0xF;
        var caseBits = block.getUint16(offset + ENTRY_OFFSETS.CASE_BITS, true);
        var name = readFileName(block, offset + ENTRY_OFFSETS.FILE_NAME, nameLength, caseBits);
        var fileType = block.getUint8(offset + ENTRY_OFFSETS.FILE_TYPE);
        var creation = uint32ToDate(block.getUint32(offset + ENTRY_OFFSETS.CREATION, true));
        var version = block.getUint8(offset + ENTRY_OFFSETS.VERSION);
        var minVersion = block.getUint8(offset + ENTRY_OFFSETS.MIN_VERSION);
        var access = block.getUint8(offset + ENTRY_OFFSETS.ACCESS);
        var auxType = block.getUint16(offset + ENTRY_OFFSETS.AUX_TYPE, true);
        var lastMod = uint32ToDate(block.getUint32(offset + ENTRY_OFFSETS.LAST_MOD, true));
        var headerPointer = block.getUint16(offset + ENTRY_OFFSETS.HEADER_POINTER, true);

        return {
            storageType,
            name,
            fileType,
            creation,
            version,
            minVersion,
            access,
            auxType,
            lastMod,
            headerPointer
        };
    }

    function readEntries(block, entryLength, fileCount, entriesPerBlock, next) {
        var entries = [];
        var offset = entryLength + 0x4;
        var count = 2;

        for (var idx = 0; idx < fileCount; idx++) {
            entries.push(readEntry(block, offset));
            offset += entryLength;
            count++;
            if (count >= entriesPerBlock) {
                block = new DataView(_disk.blocks[next].buffer);
                next = block.getUint16(VDH_OFFSETS.NEXT, true);
                offset = 0x4;
                count = 0;
            }
        }
    }

    return {
        vtoc: function() {
            var block = new DataView(_disk.blocks[VDH_BLOCK].buffer);

            var next = block.getUint16(VDH_OFFSETS.NEXT, true);
            var storageType = block.getUint8(VDH_OFFSETS.STORAGE_TYPE) >> 4;
            var nameLength = block.getUint8(VDH_OFFSETS.NAME_LENGTH) & 0xF;
            var caseBits = block.getUint8(VDH_OFFSETS.CASE_BITS);
            var name = readFileName(block, VDH_OFFSETS.VOLUME_NAME, nameLength, caseBits);
            var creation = uint32ToDate(block.getUint32(VDH_OFFSETS.CREATION, true));
            var version = block.getUint8(VDH_OFFSETS.VERSION);
            var minVersion = block.getUint8(VDH_OFFSETS.MIN_VERSION);
            var access = block.getUint8(VDH_OFFSETS.ACCESS);
            var entryLength = block.getUint8(VDH_OFFSETS.ENTRY_LENGTH);
            var entriesPerBlock = block.getUint8(VDH_OFFSETS.ENTRIES_PER_BLOCK);
            var fileCount = block.getUint16(VDH_OFFSETS.FILE_COUNT, true);
            var totalBlocks = block.getUint16(VDH_OFFSETS.TOTAL_BLOCKS, true);

            var entries = readEntries(block, entryLength, fileCount, entriesPerBlock, next);

            return {
                storageType,
                name,
                creation,
                version,
                minVersion,
                access,
                entryLength,
                entriesPerBlock,
                fileCount,
                totalBlocks,
                entries
            };
        },

        directory: function(fileEntry) {
            var block = new DataView(_disk.blocks[fileEntry.headerPointer].buffer);

            var next = block.getUint16(HEADER_OFFSETS.NEXT, true);
            var storageType = block.getUint8(HEADER_OFFSETS.STORAGE_TYPE) >> 4;
            var nameLength = block.getUint8(HEADER_OFFSETS.NAME_LENGTH) & 0xF;
            var caseBits = block.getUint8(HEADER_OFFSETS.CASE_BITS);
            var name = readFileName(block, HEADER_OFFSETS.VOLUME_NAME, nameLength, caseBits);
            var creation = uint32ToDate(block.getUint32(HEADER_OFFSETS.CREATION, true));
            var version = block.getUint8(HEADER_OFFSETS.VERSION);
            var minVersion = block.getUint8(HEADER_OFFSETS.MIN_VERSION);
            var access = block.getUint8(HEADER_OFFSETS.ACCESS);
            var entryLength = block.getUint8(HEADER_OFFSETS.ENTRY_LENGTH);
            var entriesPerBlock = block.getUint8(HEADER_OFFSETS.ENTRIES_PER_BLOCK);
            var fileCount = block.getUint16(HEADER_OFFSETS.FILE_COUNT, true);

            var entries = readEntries(block, entryLength, fileCount, entriesPerBlock, next);

            return {
                storageType,
                name,
                creation,
                version,
                minVersion,
                access,
                entryLength,
                entriesPerBlock,
                fileCount,
                entries
            };
        }
    };
}
