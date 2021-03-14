/* Copyright 2017 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

import { allocMemPages, debug } from '../util';
import { Card, Restorable, byte, Color, memory, word } from '../types';
import { ROM, VIDEO_ROM } from '../roms/cards/videoterm';

interface VideotermState {
    curReg: byte,
    startPos: word,
    cursorPos: word,
    bank: byte,
    buffer: memory,
    regs: byte[],
}

const LOC = {
    IOREG: 0x80,
    IOVAL: 0x81
} as const;

const REGS = {
    CURSOR_UPPER: 0x0A,
    CURSOR_LOWER: 0x0B,
    STARTPOS_HI: 0x0C,
    STARTPOS_LO: 0x0D,
    CURSOR_HI: 0x0E,
    CURSOR_LO: 0x0F,
    LIGHTPEN_HI: 0x10,
    LIGHTPEN_LO: 0x11
} as const;

const CURSOR_MODES = {
    SOLID: 0x00,
    HIDDEN: 0x01,
    BLINK: 0x10,
    FAST_BLINK: 0x11
} as const;

const BLACK: Color = [0x00, 0x00, 0x00];
const WHITE: Color = [0xff, 0xff, 0xff];

export default class Videoterm implements Card, Restorable<VideotermState> {
    private regs = [
        0x7b, // 00 - Horiz. total
        0x50, // 01 - Horiz. displayed
        0x62, // 02 - Horiz. sync pos
        0x29, // 03 - Horiz. sync width
        0x1b, // 04 - Vert. total
        0x08, // 05 - Vert. adjust
        0x18, // 06 - Vert. displayed
        0x19, // 07 - Vert. sync pos
        0x00, // 08 - Interlaced
        0x08, // 09 - Max. scan line
        0xc0, // 0A - Cursor upper
        0x08, // 0B - Cursor lower
        0x00, // 0C - Startpos Hi
        0x00, // 0D - Startpos Lo
        0x00, // 0E - Cursor Hi
        0x00, // 0F - Cursor Lo
        0x00, // 10 - Lightpen Hi
        0x00  // 11 - Lightpen Lo
    ];

    private blink = false;
    private curReg = 0;
    private startPos: word;
    private cursorPos: word;
    private shouldRefresh: boolean;

    // private cursor = 0;
    private bank = 0;
    private buffer = allocMemPages(8);
    private imageData;
    private dirty = false;

    constructor() {
        debug('Videx Videoterm');

        this.imageData = new ImageData(560, 192);
        for (let idx = 0; idx < 560 * 192 * 4; idx++) {
            this.imageData.data[idx] = 0xff;
        }

        for (let idx = 0; idx < 0x800; idx++) {
            this.buffer[idx] = idx & 0xff;
        }

        this.refresh();

        setInterval(() => {
            this.blink = !this.blink;
            this.refreshCursor(false);
        }, 300);
    }

    private updateBuffer(addr: word, val: byte) {
        this.buffer[addr] = val;
        val &= 0x7f; // XXX temp
        const saddr = (0x800 + addr - this.startPos) & 0x7ff;
        const data = this.imageData.data;
        const row = (saddr / 80) & 0xff;
        const col = saddr % 80;
        const x = col * 7;
        const y = row << 3;
        const c = val << 4;
        let color;

        if (row < 25) {
            this.dirty = true;
            for (let idx = 0; idx < 8; idx++) {
                let cdata = VIDEO_ROM[c + idx];
                for (let jdx = 0; jdx < 7; jdx++) {
                    if (cdata & 0x80) {
                        color = WHITE;
                    } else {
                        color = BLACK;
                    }
                    data[(y + idx) * 560 * 4 + (x + jdx) * 4] = color[0];
                    data[(y + idx) * 560 * 4 + (x + jdx) * 4 + 1] = color[1];
                    data[(y + idx) * 560 * 4 + (x + jdx) * 4 + 2] = color[2];
                    cdata <<= 1;
                }
            }
        }
    }

    private refreshCursor(fromRegs: boolean) {
        const addr = this.regs[REGS.CURSOR_HI] << 8 | this.regs[REGS.CURSOR_LO];
        const saddr = (0x800 + addr - this.startPos) & 0x7ff;
        const data = this.imageData.data;
        const row = (saddr / 80) & 0xff;
        const col = saddr % 80;
        const x = col * 7;
        const y = row << 3;
        const blinkmode = (this.regs[REGS.CURSOR_UPPER] & 0x60) >> 5;

        if (fromRegs) {
            if (addr !== this.cursorPos) {
                const caddr = (0x800 + this.cursorPos - this.startPos) & 0x7ff;
                this.updateBuffer(caddr, this.buffer[caddr]);
                this.cursorPos = addr;
            }
        }

        this.updateBuffer(addr, this.buffer[addr]);
        if (blinkmode === CURSOR_MODES.HIDDEN) {
            return;
        }
        if (this.blink || (blinkmode === CURSOR_MODES.SOLID)) {
            this.dirty = true;
            for (let idx = 0; idx < 8; idx++) {
                const color = WHITE;
                if (idx >= (this.regs[REGS.CURSOR_UPPER] & 0x1f) &&
                    idx <= (this.regs[REGS.CURSOR_LOWER] & 0x1f)) {
                    for (let jdx = 0; jdx < 7; jdx++) {
                        data[(y + idx) * 560 * 4 + (x + jdx) * 4] = color[0];
                        data[(y + idx) * 560 * 4 + (x + jdx) * 4 + 1] = color[1];
                        data[(y + idx) * 560 * 4 + (x + jdx) * 4 + 2] = color[2];
                    }
                }
            }
        }
    }

    private updateStartPos() {
        const startPos =
            this.regs[REGS.STARTPOS_HI] << 8 |
            this.regs[REGS.STARTPOS_LO];
        if (this.startPos != startPos) {
            this.startPos = startPos;
            this.shouldRefresh = true;
        }
    }

    private refresh() {
        for (let idx = 0; idx < 0x800; idx++) {
            this.updateBuffer(idx, this.buffer[idx]);
        }
    }

    private access(off: byte, val?: byte) {
        let result = undefined;
        switch (off & 0x81) {
            case LOC.IOREG:
                if (val !== undefined) {
                    this.curReg = val;
                } else {
                    result = this.curReg;
                }
                break;
            case LOC.IOVAL:
                if (val !== undefined) {
                    this.regs[this.curReg] = val;
                    switch (this.curReg) {
                        case REGS.CURSOR_UPPER:
                        case REGS.CURSOR_LOWER:
                            this.refreshCursor(true);
                            break;
                        case REGS.CURSOR_HI:
                        case REGS.CURSOR_LO:
                            this.refreshCursor(true);
                            break;
                        case REGS.STARTPOS_HI:
                        case REGS.STARTPOS_LO:
                            this.updateStartPos();
                            break;
                    }
                } else {
                    result = this.regs[this.curReg];
                }
                break;
        }
        this.bank = (off & 0x0C) >> 2;
        return result;
    }

    ioSwitch(off: byte, val?: byte) {
        return this.access(off, val);
    }

    read(page: byte, off: byte) {
        if (page < 0xcc) {
            return ROM[(page & 0x03) << 8 | off];
        } else if (page < 0xce){
            const addr = ((page & 0x01) + (this.bank << 1)) << 8 | off;
            return this.buffer[addr];
        }
        return 0;
    }

    write(page: byte, off: byte, val: byte) {
        if (page > 0xcb && page < 0xce) {
            const addr = ((page & 0x01) + (this.bank << 1)) << 8 | off;
            this.updateBuffer(addr, val);
        }
    }

    blit() {
        if (this.shouldRefresh) {
            this.refresh();
            this.shouldRefresh = false;
        }
        if (this.dirty) {
            this.dirty = false;
            return this.imageData;
        }
        return;
    }

    getState() {
        return {
            curReg: this.curReg,
            startPos: this.startPos,
            cursorPos: this.cursorPos,
            bank: this.bank,
            buffer: new Uint8Array(this.buffer),
            regs: [...this.regs],
        };
    }

    setState(state: VideotermState) {
        this.curReg = state.curReg;
        this.startPos = state.startPos;
        this.cursorPos = state.cursorPos;
        this.bank = state.bank;
        this.buffer = new Uint8Array(this.buffer);
        this.regs = [...state.regs];

        this.shouldRefresh = true;
        this.dirty = true;
    }
}
