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

import { debug } from '../../util';
import { STORAGE_TYPES } from './constants';
import { Directory } from './directory';

export function uint32ToDate(val) {
    // yyyyyyy m|mmmm ddddd|000hhhhh|00mmmmmm

    if (val) {
        var yearMonthDay = val & 0xffff;
        var hourMinute = val >> 16;

        var year = yearMonthDay >> 9;
        var month = (yearMonthDay & 0x01E0) >> 5;
        var day = yearMonthDay & 0x001F;

        var hour = hourMinute >> 8;
        var min = hourMinute & 0xff;

        return new Date(1900 + year, month - 1, day, hour, min);
    }
    return null;
}

export function dateToUint32(date) {
    // yyyyyyy m|mmmm ddddd|000hhhhh|00mmmmmm

    var val = 0;

    if (date) {
        var year = date.getYear() - 1900;
        var month = date.getMonth() + 1;
        var day = date.getDate();

        var hour = date.getHour();
        var min = date.getMinute();

        var yearMonthDay = year << 9 | month << 5 | day;
        var hourMinute = hour << 8 | min;
        val = hourMinute << 16 | yearMonthDay;
    }

    return val;
}

export function readFileName(block, offset, nameLength, caseBits) {
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

export function writeFileName(block, offset, name) {
    var caseBits = 0;
    for (var idx = 0; idx < name.length; idx++) {
        caseBits <<= 1;
        var charCode = name.charCodeAt(idx);
        if (charCode > 0x60 && charCode < 0x7B) {
            caseBits |= 0x1;
            charCode -= 0x20;
        }
        block.setUint8(offset + idx, charCode);
    }
    return caseBits;
}

export function dumpDirectory(volume, dirEntry, depth) {
    var dir = new Directory(volume, dirEntry);
    dir.read();

    for (var idx = 0; idx < dir.entries.length; idx++) {
        var fileEntry = dir.entries[idx];
        if (fileEntry.storageType !== STORAGE_TYPES.DELETED) {
            debug(depth, fileEntry.name);
            if (fileEntry.storageType === STORAGE_TYPES.DIRECTORY) {
                dumpDirectory(volume, fileEntry, depth + '  ');
            }
        }
    }
}

export function dump(volume) {
    var vdh = volume.vdh();
    debug(vdh.name);
    for (var idx = 0; idx < vdh.entries.length; idx++) {
        var fileEntry = vdh.entries[idx];
        debug(fileEntry.name);
        if (fileEntry.storageType === STORAGE_TYPES.DIRECTORY) {
            dumpDirectory(volume, fileEntry, '  ');
        }
    }
}
