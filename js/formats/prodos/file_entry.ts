import { dateToUint32, readFileName, writeFileName, uint32ToDate } from './utils';
import { STORAGE_TYPES, ACCESS_TYPES } from './constants';
import type { byte, word } from 'js/types';
import { toHex } from 'js/util';
import { ProDOSVolume } from '.';
import { VDH } from './vdh';
import { Directory } from './directory';
import { ProDOSFile } from './base_file';
import { SaplingFile } from './sapling_file';
import { SeedlingFile } from './seedling_file';
import { TreeFile } from './tree_file';
import ApplesoftDump from 'js/applesoft/decompiler';

const ENTRY_OFFSETS = {
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
} as const;

export class FileEntry {
    block: DataView;
    offset: word;

    storageType: byte = STORAGE_TYPES.SEEDLING;
    name: string = 'Untitled';
    fileType: byte = 0;
    auxType: word = 0;
    blocksUsed: word = 0;
    eof: number = 0;
    access: byte = ACCESS_TYPES.ALL;
    creation: Date = new Date();
    lastMod: Date = new Date();
    keyPointer: word = 0;
    headerPointer: word = 0;

    constructor(public volume: ProDOSVolume) { }

    read(block: DataView, offset: word) {
        this.block = block;
        this.offset = offset;

        this.storageType = block.getUint8(offset + ENTRY_OFFSETS.STORAGE_TYPE) >> 4;
        const nameLength = block.getUint8(offset + ENTRY_OFFSETS.NAME_LENGTH) & 0xF;
        const caseBits = block.getUint16(offset + ENTRY_OFFSETS.CASE_BITS, true);
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
    }

    write(block?: DataView, offset?: word) {
        this.block = block ?? this.block;
        this.offset = offset ?? this.offset;

        const nameLength = this.name.length & 0x0f;
        this.block.setUint8(this.offset + ENTRY_OFFSETS.STORAGE_TYPE, this.storageType << 4 & nameLength);
        const caseBits = writeFileName(this.block, this.offset + ENTRY_OFFSETS.FILE_NAME, this.name);
        this.block.setUint16(this.offset + ENTRY_OFFSETS.CASE_BITS, caseBits);
        this.block.setUint8(this.offset + ENTRY_OFFSETS.FILE_TYPE, this.fileType);
        this.block.setUint16(this.offset + ENTRY_OFFSETS.KEY_POINTER, this.keyPointer, true);
        this.block.setUint16(this.offset + ENTRY_OFFSETS.BLOCKS_USED, this.blocksUsed, true);
        this.block.setUint8(this.offset + ENTRY_OFFSETS.EOF, this.eof & 0xff);
        this.block.setUint8(this.offset + ENTRY_OFFSETS.EOF + 1, (this.eof && 0xff00) >> 8);
        this.block.setUint8(this.offset + ENTRY_OFFSETS.EOF + 2, this.eof >> 16);
        this.block.setUint32(this.offset + ENTRY_OFFSETS.CREATION, dateToUint32(this.creation), true);
        this.block.setUint8(this.offset + ENTRY_OFFSETS.ACCESS, this.access);
        this.block.setUint16(this.offset + ENTRY_OFFSETS.AUX_TYPE, this.auxType, true);
        this.block.setUint32(this.offset + ENTRY_OFFSETS.LAST_MOD, dateToUint32(this.lastMod), true);
        this.block.setUint16(this.offset + ENTRY_OFFSETS.HEADER_POINTER, this.headerPointer, true);
    }

    getFileData() {
        let file: ProDOSFile | null = null;

        switch (this.storageType) {
            case STORAGE_TYPES.SEEDLING:
                file = new SeedlingFile(this.volume, this);
                break;
            case STORAGE_TYPES.SAPLING:
                file = new SaplingFile(this.volume, this);
                break;
            case STORAGE_TYPES.TREE:
                file = new TreeFile(this.volume, this);
                break;
        }

        if (file) {
            return file.read();
        }
    }

    getFileText() {
        const data = this.getFileData();
        let result: string | null = null;
        let address = 0;

        if (data) {
            if (this.fileType === 0xFC) { // BAS
                result = new ApplesoftDump(data, 0).decompile();
            } else {
                if (this.fileType === 0x06) { // BIN
                    address = this.auxType;
                }
                result = '';
                let hex = '';
                let ascii = '';
                for (let idx = 0; idx < data.length; idx++) {
                    const val = data[idx];
                    if (idx % 16 === 0) {
                        if (idx !== 0) {
                            result += `${hex}    ${ascii}\n`;
                        }
                        hex = '';
                        ascii = '';
                        result += `${toHex(address + idx, 4)}:`;
                    }
                    hex += ` ${toHex(val)}`;
                    ascii += (val & 0x7f) >= 0x20 ? String.fromCharCode(val & 0x7f) : '.';
                }
                result += '\n';
            }
        }
        return result;
    }
}

export function readEntries(volume: ProDOSVolume, block: DataView, header: VDH | Directory) {
    const blocks = volume.blocks();
    const entries = [];
    let offset = header.entryLength + 0x4;
    let count = 2;
    let next = header.next;

    for (let idx = 0; idx < header.fileCount;) {
        const fileEntry = new FileEntry(volume);
        fileEntry.read(block, offset);
        entries.push(fileEntry);
        if (fileEntry.storageType !== STORAGE_TYPES.DELETED) {
            idx++;
        }
        offset += header.entryLength;
        count++;
        if (count > header.entriesPerBlock) {
            block = new DataView(blocks[next].buffer);
            next = block.getUint16(0x02, true);
            offset = 0x4;
            count = 1;
        }
    }

    return entries;
}

export function writeEntries(volume: ProDOSVolume, block: DataView, header: VDH | Directory) {
    const blocks = volume.blocks();
    const bitMap = volume.bitMap();
    let offset = header.entryLength + 0x4;
    let count = 2;
    let next = header.next;

    for (let idx = 0; idx < header.fileCount; idx++) {
        const fileEntry = header.entries[idx];
        fileEntry.write(block, offset);
        offset += header.entryLength;
        count++;
        if (count >= header.entriesPerBlock) {
            const prev = next;
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
        bitMap.freeBlock(next);
        next = block.getUint16(0x02, true);
    }
}
