import { debug } from '../../util';
import { STORAGE_TYPES } from './constants';
import { Directory } from './directory';
import type { byte, word } from 'js/types';
import { ProDOSVolume } from '.';
import { FileEntry } from './file_entry';

export function uint32ToDate(val: word) {
    // yyyyyyy m|mmmm ddddd|000hhhhh|00mmmmmm

    if (val) {
        const yearMonthDay = val & 0xffff;
        const hourMinute = val >> 16;

        const year = yearMonthDay >> 9;
        const month = (yearMonthDay & 0x01E0) >> 5;
        const day = yearMonthDay & 0x001F;

        const hour = hourMinute >> 8;
        const min = hourMinute & 0xff;

        return new Date(1900 + year, month - 1, day, hour, min);
    }
    return new Date(0);
}

export function dateToUint32(date: Date) {
    // yyyyyyy m|mmmm ddddd|000hhhhh|00mmmmmm

    let val = 0;

    if (date) {
        const year = date.getFullYear() - 1900;
        const month = date.getMonth() + 1;
        const day = date.getDate();

        const hour = date.getHours();
        const min = date.getMinutes();

        const yearMonthDay = year << 9 | month << 5 | day;
        const hourMinute = hour << 8 | min;
        val = hourMinute << 16 | yearMonthDay;
    }

    return val;
}

export function readFileName(block: DataView, offset: word, nameLength: byte, caseBits: word) {
    let name = '';
    if (!(caseBits & 0x8000)) {
        caseBits = 0;
    }
    for (let idx = 0; idx < nameLength; idx++) {
        caseBits <<= 1;
        const char = String.fromCharCode(block.getUint8(offset + idx));
        name += caseBits & 0x8000 ? char.toLowerCase() : char;
    }
    return name;
}

export function writeFileName(block: DataView, offset: word, name: string) {
    let caseBits = 0;
    for (let idx = 0; idx < name.length; idx++) {
        caseBits <<= 1;
        let charCode = name.charCodeAt(idx);
        if (charCode > 0x60 && charCode < 0x7B) {
            caseBits |= 0x1;
            charCode -= 0x20;
        }
        block.setUint8(offset + idx, charCode);
    }
    return caseBits;
}

export function dumpDirectory(volume: ProDOSVolume, dirEntry: FileEntry, depth: string) {
    const dir = new Directory(volume, dirEntry);
    dir.read();

    for (let idx = 0; idx < dir.entries.length; idx++) {
        const fileEntry = dir.entries[idx];
        if (fileEntry.storageType !== STORAGE_TYPES.DELETED) {
            debug(depth, fileEntry.name);
            if (fileEntry.storageType === STORAGE_TYPES.DIRECTORY) {
                dumpDirectory(volume, fileEntry, depth + '  ');
            }
        }
    }
}

export function dump(volume: ProDOSVolume) {
    const vdh = volume.vdh();
    debug(vdh.name);
    for (let idx = 0; idx < vdh.entries.length; idx++) {
        const fileEntry = vdh.entries[idx];
        debug(fileEntry.name);
        if (fileEntry.storageType === STORAGE_TYPES.DIRECTORY) {
            dumpDirectory(volume, fileEntry, '  ');
        }
    }
}
