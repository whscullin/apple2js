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
import { readEntries, writeEntries } from './file_entry';
import { STORAGE_TYPES, ACCESS_TYPES } from './constants';

export function VDH(volume) {
    var blocks = volume.blocks();

    var VDH_BLOCK = 2;
    var VDH_OFFSETS = {
        PREV: 0x00,
        NEXT: 0x02,
        STORAGE_TYPE: 0x04,
        NAME_LENGTH: 0x04,
        VOLUME_NAME: 0x05,
        RESERVED_1: 0x14,
        CASE_BITS: 0x1A,
        CREATION: 0x1C,
        VERSION: 0x20,
        MIN_VERSION: 0x21,
        ACCESS: 0x22,
        ENTRY_LENGTH: 0x23,
        ENTRIES_PER_BLOCK: 0x24,
        FILE_COUNT: 0x25,
        BIT_MAP_POINTER: 0x27,
        TOTAL_BLOCKS: 0x29,
    };

    return {
        prev: 0,
        next: 0,
        storageType: STORAGE_TYPES.VDH_HEADER,
        name: '',
        creation: new Date(),
        access: ACCESS_TYPES.ALL,
        entryLength: 0x27,
        entriesPerBlock: 23,
        fileCount: 0,
        bitMapPointer: 0,
        totalBlocks: 0,
        entries: [],

        read: function () {
            var block = new DataView(blocks[VDH_BLOCK].buffer);

            this.next = block.getUint16(VDH_OFFSETS.NEXT, true);
            this.storageType = block.getUint8(VDH_OFFSETS.STORAGE_TYPE) >> 4;
            var nameLength = block.getUint8(VDH_OFFSETS.NAME_LENGTH) & 0xF;
            var caseBits = block.getUint8(VDH_OFFSETS.CASE_BITS);
            this.name = readFileName(block, VDH_OFFSETS.VOLUME_NAME, nameLength, caseBits);
            this.creation = uint32ToDate(block.getUint32(VDH_OFFSETS.CREATION, true));
            this.access = block.getUint8(VDH_OFFSETS.ACCESS);
            this.entryLength = block.getUint8(VDH_OFFSETS.ENTRY_LENGTH);
            this.entriesPerBlock = block.getUint8(VDH_OFFSETS.ENTRIES_PER_BLOCK);
            this.fileCount = block.getUint16(VDH_OFFSETS.FILE_COUNT, true);
            this.bitMapPointer = block.getUint16(VDH_OFFSETS.BIT_MAP_POINTER, true);
            this.totalBlocks = block.getUint16(VDH_OFFSETS.TOTAL_BLOCKS, true);

            this.entries = readEntries(volume, block, this);
        },

        write: function() {
            var block = new DataView(blocks[VDH_BLOCK].buffer);

            var nameLength = name.length & 0x0f;
            block.setUint8(VDH_OFFSETS.STORAGE_TYPE, this.storageType << 4 & nameLength);
            var caseBits = writeFileName(block, VDH_OFFSETS.FILE_NAME, this.name);
            block.setUint32(VDH_OFFSETS.CREATION, dateToUint32(this.creation), true);
            block.setUint16(VDH_OFFSETS.CASE_BITS, caseBits);
            block.setUint8(VDH_OFFSETS.ACCESS, this.access);
            block.setUint8(VDH_OFFSETS.ENTRY_LENGTH, this.entryLength);
            block.setUint8(VDH_OFFSETS.ENTRIES_PER_BLOCK, this.entriesPerBlock);
            block.setUint16(VDH_OFFSETS.FILE_COUNT, this.fileCount, true);
            block.setUint16(VDH_OFFSETS.BIT_MAP_POINTER, this.bitMapPointer, true);
            block.setUint16(VDH_OFFSETS.TOTAL_BLOCKS, this.totalBlocks, true);

            writeEntries(blocks, block, this);
        }

    };
}
