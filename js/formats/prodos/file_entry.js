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

import { dateToUint32, readFileName, writeFileName, uint32ToDate } from './utils';
import { STORAGE_TYPES, ACCESS_TYPES } from './constants';

export function FileEntry () {
    var ENTRY_OFFSETS = {
        STORAGE_TYPE: 0x00,
        NAME_LENGTH: 0x00,
        FILE_NAME: 0x01,
        FILE_TYPE: 0x10,
        KEY_POINTER: 0x11,
        BLOCKS_USED: 0x13,
        EOF: 0x15,
        CREATION: 0x18,
        CASE_BITS: 0x1C,
        VERSION: 0x1C,
        MIN_VERSION: 0x1D,
        ACCESS: 0x1E,
        AUX_TYPE: 0x1F,
        LAST_MOD: 0x21,
        HEADER_POINTER: 0x25
    };

    var _block;
    var _offset;

    return {
        storageType: STORAGE_TYPES.SEEDLING,
        name: 'Untitled',
        fileType: 0,
        auxType: 0,
        blocksUsed: 0,
        eof: 0,
        access: ACCESS_TYPES.ALL,
        creation: new Date(),
        lastMod: new Date(),
        keyPointer: 0,
        headerPointer: 0,

        read: function(block, offset) {
            _block = block;
            _offset = offset;

            this.storageType = block.getUint8(offset + ENTRY_OFFSETS.STORAGE_TYPE) >> 4;
            var nameLength = block.getUint8(offset + ENTRY_OFFSETS.NAME_LENGTH) & 0xF;
            var caseBits = block.getUint16(offset + ENTRY_OFFSETS.CASE_BITS, true);
            this.name = readFileName(block, offset + ENTRY_OFFSETS.FILE_NAME, nameLength, caseBits);
            this.fileType = block.getUint8(offset + ENTRY_OFFSETS.FILE_TYPE);
            this.keyPointer = block.getUint16(offset + ENTRY_OFFSETS.KEY_POINTER, true);
            this.blocksUsed = block.getUint16(offset + ENTRY_OFFSETS.BLOCKS_USED, true);
            this.eof =
                block.getUint8(offset + ENTRY_OFFSETS.EOF) |
                block.getUint8(offset + ENTRY_OFFSETS.EOF + 1) << 8 |
                block.getUint8(offset + ENTRY_OFFSETS.EOF + 2) << 16;
            this.creation = uint32ToDate(block.getUint32(offset + ENTRY_OFFSETS.CREATION, true));
            this.access = block.getUint8(offset + ENTRY_OFFSETS.ACCESS);
            this.auxType = block.getUint16(offset + ENTRY_OFFSETS.AUX_TYPE, true);
            this.lastMod = uint32ToDate(block.getUint32(offset + ENTRY_OFFSETS.LAST_MOD, true));
            this.headerPointer = block.getUint16(offset + ENTRY_OFFSETS.HEADER_POINTER, true);
        },

        write: function(block, offset) {
            block = block || _block;
            offset = offset || _offset;

            var nameLength = name.length & 0x0f;
            block.setUint8(offset + ENTRY_OFFSETS.STORAGE_TYPE, this.storageType << 4 & nameLength);
            var caseBits = writeFileName(block, offset + ENTRY_OFFSETS.FILE_NAME, this.name);
            block.setUint16(offset + ENTRY_OFFSETS.CASE_BITS, caseBits);
            block.setUint8(offset + ENTRY_OFFSETS.FILE_TYPE, this.fileType);
            block.setUint16(offset + ENTRY_OFFSETS.KEY_POINTER, this.keyPointer, true);
            block.setUint16(offset + ENTRY_OFFSETS.BLOCKS_USED, this.blocksUsed, true);
            block.setUint8(offset + ENTRY_OFFSETS.EOF, this.eof & 0xff);
            block.setUint8(offset + ENTRY_OFFSETS.EOF + 1, (this.eof && 0xff00) >> 8);
            block.setUint8(offset + ENTRY_OFFSETS.EOF + 2, this.eof >> 16);
            block.setUint32(offset + ENTRY_OFFSETS.CREATION, dateToUint32(this.creation), true);
            block.setUint8(offset + ENTRY_OFFSETS.ACCESS, this.access);
            block.setUint16(offset + ENTRY_OFFSETS.AUX_TYPE, this.auxType, true);
            block.setUint32(offset + ENTRY_OFFSETS.LAST_MOD, dateToUint32(this.lastMod), true);
            block.setUint16(offset + ENTRY_OFFSETS.HEADER_POINTER, this.headerPointer, true);
        }
    };
}

export function readEntries(volume, block, header) {
    var blocks = volume.blocks();
    var entries = [];
    var offset = header.entryLength + 0x4;
    var count = 2;
    var next = header.next;

    for (var idx = 0; idx < header.fileCount; idx++) {
        var fileEntry = new FileEntry();
        fileEntry.read(block, offset);
        entries.push(fileEntry);
        offset += header.entryLength;
        count++;
        if (count >= header.entriesPerBlock) {
            block = new DataView(blocks[next].buffer);
            next = block.getUint16(0x02, true);
            offset = 0x4;
            count = 0;
        }
    }

    return entries;
}

export function writeEntries(volume, block, header) {
    var blocks = volume.blocks();
    var bitMap = volume.bitmap();
    var offset = header.entryLength + 0x4;
    var count = 2;
    var next = header.next;

    for (var idx = 0; idx < header.fileCount; idx++) {
        var fileEntry = new header.entries[idx];
        fileEntry.write(block, offset);
        offset += header.entryLength;
        count++;
        if (count >= header.entriesPerBlock) {
            var prev = next;
            if (!next) {
                next = bitMap.allocBlock();
            }
            block = new DataView(blocks[next].buffer);
            block.setUint16(0x00, prev, true);
            next = block.getUint16(0x02, true);
            offset = 0x4;
            count = 0;
        }
    }
    next = block.getUint16(0x02, true);
    block.setUint16(0x02, 0, true);
    while (next) {
        block = new DataView(blocks[next].buffer);
        bitMap.freeLock(next);
        next = block.getUint16(0x02, true);
    }
}
