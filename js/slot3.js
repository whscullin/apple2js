/* Copyright 2010-2016 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

/*exported Slot3*/

function Slot3(mmu, rom)
{
    'use strict';

    var auxRomFn = {
        start: function auxRom_start() {
            return 0xc8;
        },
        end: function auxRom_end() {
            return 0xcf;
        },
        read: function auxRom_read(page, off) {
            return rom.read(page, off);
        },
        write: function auxRom_write() {}
    };

    return {
        start: function slot3_start() {
            return 0xc3;
        },
        end: function slot3_end() {
            return 0xc3;
        },
        read: function slot3_read(page, off) {
            mmu.auxRom(0x3, auxRomFn);
            return rom.read(page, off);
        },
        write: function slot3_write() {
            mmu.auxRom(0x3, auxRomFn);
        }
    };

}
