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

import { base64_decode, base64_encode } from './base64';
import { byte, memory, Memory } from './types';
import { allocMemPages } from './util';
import {
    Color,
    GraphicsState,
    HiresPage,
    LoresPage,
    Region,
    VideoModes,
    VideoModesState,
    bank,
    pageNo
} from './videomodes';

let enhanced = false;
let multiScreen = false;
let textMode = true;
let mixedMode = false;
let hiresMode = false;
let pageMode: pageNo = 1;
let _80colMode = false;
let altCharMode = false;
let an3 = false;
let doubleHiresMode = false;
let monoDHRMode = false;
const colorDHRMode = false;
let mixedDHRMode = false;
let highColorHGRMode = false;
let highColorTextMode = false;
let oneSixtyMode = false;

function dim(c: Color): Color {
    return [
        c[0] * 0.75 & 0xff,
        c[1] * 0.75 & 0xff,
        c[2] * 0.75 & 0xff
    ];
}

function rowToBase(row: number) {
    const ab = (row >> 3) & 3;
    const cd = (row >> 1) & 0x3;
    const e = row & 1;
    return (cd << 8) | (e << 7) | (ab << 5) | (ab << 3);
}


// hires colors
const orangeCol: Color = [255, 106, 60];
const greenCol: Color = [20, 245, 60];
const blueCol: Color = [20, 207, 253];
const violetCol: Color = [255, 68, 253];
const whiteCol: Color = [255, 255, 255];
const blackCol: Color = [0, 0, 0];

// lores colors
const _colors: Color[] = [
    [0, 0, 0], // 0x0 black
    [227, 30, 96], // 0x1 deep red
    [96, 78, 189], // 0x2 dark blue
    [255, 68, 253], // 0x3 purple
    [0, 163, 96], // 0x4 dark green
    [156, 156, 156], // 0x5 dark gray
    [20, 207, 253], // 0x6 medium blue
    [208, 195, 255], // 0x7 light blue
    [96, 114, 3], // 0x8 brown
    [255, 106, 60], // 0x9 orange
    [156, 156, 156], // 0xa light gray
    [255, 160, 208], // 0xb pink
    [20, 245, 60], // 0xc green
    [208, 221, 141], // 0xd yellow
    [114, 255, 208], // 0xe aquamarine
    [255, 255, 255], // 0xf white
];

//
const r4 = [
    0,   // Black
    2,   // Dark Blue
    4,   // Dark Green
    6,   // Medium Blue

    8,   // Brown
    5,   // Gray 1
    12,  // Light Green
    14,  // Aqua

    1,   // Red
    3,   // Purple
    10,  // Gray 2
    7,  // Pink

    9,   // Orange
    11,   // Light Blue
    13,  // Yellow
    15   // White
];

const dcolors: Color[] = [
    [0, 0, 0], // 0x0 black
    [227, 30, 96], // 0x1 deep red
    [96, 78, 189], // 0x2 dark blue
    [255, 68, 253], // 0x3 purple
    [0, 163, 96], // 0x4 dark green
    [156, 156, 156], // 0x5 dark gray
    [20, 207, 253], // 0x6 medium blue
    [208, 195, 255], // 0x7 light blue
    [96, 114, 3], // 0x8 brown
    [255, 106, 60], // 0x9 orange
    [156, 156, 156], // 0xa light gray
    [255, 160, 208], // 0xb pink
    [20, 245, 60], // 0xc green
    [208, 221, 141], // 0xd yellow
    [114, 255, 208], // 0xe aquamarine
    [255, 255, 255], // 0xf white
];


/****************************************************************************
 *
 * Text/Lores Graphics
 *
 ***************************************************************************/

export class LoresPage2D implements LoresPage {
    // $00-$3F inverse
    // $40-$7F flashing
    // $80-$FF normal

    public imageData: ImageData;

    private _buffer: memory[] = [];
    private _refreshing = false;
    private _monoMode = false;
    private _blink = false;
    private _dirty: Region = {
        top: 385,
        bottom: -1,
        left: 561,
        right: -1
    };

    constructor(private page: number,
        private readonly charset: memory,
        private readonly e: boolean) {
        this.imageData = new ImageData(560, 384);
        for (let idx = 0; idx < 560 * 384 * 4; idx++) {
            this.imageData.data[idx] = 0xff;
        }
        this._buffer[0] = allocMemPages(0x4);
        this._buffer[1] = allocMemPages(0x4);
    }

    _drawPixel(data: Uint8ClampedArray, off: number, color: Color) {
        const c0 = color[0], c1 = color[1], c2 = color[2];
        data[off + 0] = data[off + 4] = c0;
        data[off + 1] = data[off + 5] = c1;
        data[off + 2] = data[off + 6] = c2;
        const nextOff = off + 560 * 4;
        data[nextOff] = data[nextOff + 4] = c0;
        data[nextOff + 1] = data[nextOff + 5] = c1;
        data[nextOff + 2] = data[nextOff + 6] = c2;
    }

    _drawHalfPixel(data: Uint8ClampedArray, off: number, color: Color) {
        const c0 = color[0], c1 = color[1], c2 = color[2];
        data[off + 0] = c0;
        data[off + 1] = c1;
        data[off + 2] = c2;
        const nextOff = off + 560 * 4;
        data[nextOff] = c0;
        data[nextOff + 1] = c1;
        data[nextOff + 2] = c2;
    }


    bank0(): Memory {
        return {
            start: () => this._start(),
            end: () => this._end(),
            read: (page, off) => this._read(page, off, 0),
            write: (page, off, val) => this._write(page, off, val, 0),
        };
    }

    bank1(): Memory {
        return {
            start: () => this._start(),
            end: () => this._end(),
            read: (page, off) => this._read(page, off, 1),
            write: (page, off, val) => this._write(page, off, val, 1),
        };
    }

    // These are used by both bank 0 and 1

    _start() {
        return (0x04 * this.page);
    }
    _end() { return (0x04 * this.page) + 0x03; }

    _read(page: byte, off: byte, bank: bank) {
        const addr = (page << 8) | off, base = addr & 0x3FF;
        return this._buffer[bank][base];
    }

    _write(page: byte, off: byte, val: byte, bank: bank) {
        const addr = (page << 8) | off;
        const base = addr & 0x3FF;
        let fore, back;

        if (this._buffer[bank][base] == val && !this._refreshing) {
            return;
        }
        this._buffer[bank][base] = val;

        const col = (base % 0x80) % 0x28;
        const adj = off - col;

        // 000001cd eabab000 -> 000abcde
        const ab = (adj & 0x18);
        const cd = (page & 0x03) << 1;
        const ee = adj >> 7;
        const row = ab | cd | ee;

        const data = this.imageData.data;
        if ((row < 24) && (col < 40)) {
            let y = row << 4;
            if (y < this._dirty.top) { this._dirty.top = y; }
            y += 16;
            if (y > this._dirty.bottom) { this._dirty.bottom = y; }
            let x = col * 14;
            if (x < this._dirty.left) { this._dirty.left = x; }
            x += 14;
            if (x > this._dirty.right) { this._dirty.right = x; }

            let color;
            if (textMode || hiresMode || (mixedMode && row > 19)) {
                let inverse;
                if (this.e) {
                    if (!_80colMode && !altCharMode) {
                        inverse = ((val & 0xc0) == 0x40) && this._blink;
                    }
                } else {
                    inverse = !((val & 0x80) || (val & 0x40) && this._blink);
                }

                fore = inverse ? blackCol : whiteCol;
                back = inverse ? whiteCol : blackCol;

                if (_80colMode) {
                    if (!enhanced) {
                        val = (val >= 0x40 && val < 0x60) ? val - 0x40 : val;
                    } else if (!altCharMode) {
                        val = (val >= 0x40 && val < 0x80) ? val - 0x40 : val;
                    }

                    off = (col * 14 + (bank ? 0 : 1) * 7 + row * 560 * 8 * 2) * 4;

                    for (let jdx = 0; jdx < 8; jdx++) {
                        let b = this.charset[val * 8 + jdx];
                        for (let idx = 0; idx < 7; idx++) {
                            color = (b & 0x01) ? back : fore;
                            this._drawHalfPixel(data, off, color);
                            b >>= 1;
                            off += 4;
                        }
                        off += 553 * 4 + 560 * 4;
                    }
                } else {
                    val = this._buffer[0][base];

                    if (!enhanced) {
                        val = (val >= 0x40 && val < 0x60) ? val - 0x40 : val;
                    } else if (!altCharMode) {
                        val = (val >= 0x40 && val < 0x80) ? val - 0x40 : val;
                    }

                    off = (col * 14 + row * 560 * 8 * 2) * 4;

                    if (highColorTextMode) {
                        fore = _colors[this._buffer[1][base] >> 4];
                        back = _colors[this._buffer[1][base] & 0x0f];
                    }

                    if (this.e) {
                        for (let jdx = 0; jdx < 8; jdx++) {
                            let b = this.charset[val * 8 + jdx];
                            for (let idx = 0; idx < 7; idx++) {
                                color = (b & 0x01) ? back : fore;
                                this._drawPixel(data, off, color);
                                b >>= 1;
                                off += 8;
                            }
                            off += 546 * 4 + 560 * 4;
                        }
                    } else {
                        const colorMode = mixedMode && !textMode && !this._monoMode;
                        // var val0 = col > 0 ? _buffer[0][base - 1] : 0;
                        // var val2 = col < 39 ? _buffer[0][base + 1] : 0;

                        for (let jdx = 0; jdx < 8; jdx++) {
                            let odd = !(col & 0x1);
                            let b = this.charset[val * 8 + jdx] << 1;
                            if (colorMode) {
                                // var b0 = charset[val0 * 8 + jdx];
                                // var b2 = charset[val2 * 8 + jdx];
                                if (inverse) { b ^= 0x1ff; }
                            }

                            for (let idx = 0; idx < 7; idx++) {
                                if (colorMode) {
                                    if (b & 0x80) {
                                        if ((b & 0x1c0) != 0x80) {
                                            color = whiteCol;
                                        } else {
                                            color = odd ? violetCol : greenCol;
                                        }
                                    } else {
                                        color = blackCol;
                                    }
                                    odd = !odd;
                                } else {
                                    color = (b & 0x80) ? fore : back;
                                }
                                this._drawPixel(data, off, color);
                                b <<= 1;
                                off += 8;
                            }
                            off += 546 * 4 + 560 * 4;
                        }
                    }
                }
            } else {
                if (!_80colMode && bank == 1) {
                    return;
                }
                if (_80colMode && !an3) {
                    off = (col * 14 + (bank ? 0 : 1) * 7 + row * 560 * 8 * 2) * 4;
                    if (this._monoMode) {
                        fore = whiteCol;
                        back = blackCol;
                        for (let jdx = 0; jdx < 8; jdx++) {
                            let b = (jdx < 8) ? (val & 0x0f) : (val >> 4);
                            b |= (b << 4);
                            if (bank & 0x1) {
                                b <<= 1;
                            }
                            for (let idx = 0; idx < 7; idx++) {
                                color = (b & 0x80) ? fore : back;
                                this._drawHalfPixel(data, off, color);
                                b <<= 1;
                                off += 4;
                            }
                            off += 553 * 4 + 560 * 4;
                        }
                    } else {
                        if (bank & 0x1) {
                            val = ((val & 0x77) << 1) | ((val & 0x88) >> 3);
                        }
                        for (let jdx = 0; jdx < 8; jdx++) {
                            color = _colors[(jdx < 4) ?
                                (val & 0x0f) : (val >> 4)];
                            for (let idx = 0; idx < 7; idx++) {
                                this._drawHalfPixel(data, off, color);
                                off += 4;
                            }
                            off += 553 * 4 + 560 * 4;
                        }
                    }
                } else {
                    off = (col * 14 + row * 560 * 8 * 2) * 4;

                    if (this._monoMode) {
                        fore = whiteCol;
                        back = blackCol;
                        for (let jdx = 0; jdx < 8; jdx++) {
                            let b = (jdx < 4) ? (val & 0x0f) : (val >> 4);
                            b |= (b << 4);
                            b |= (b << 8);
                            if (col & 0x1) {
                                b <<= 2;
                            }
                            for (let idx = 0; idx < 14; idx++) {
                                color = (b & 0x8000) ? fore : back;
                                this._drawHalfPixel(data, off, color);
                                b <<= 1;
                                off += 4;
                            }
                            off += 546 * 4 + 560 * 4;
                        }
                    } else {
                        for (let jdx = 0; jdx < 8; jdx++) {
                            color = _colors[(jdx < 4) ? (val & 0x0f) : (val >> 4)];
                            for (let idx = 0; idx < 7; idx++) {
                                this._drawPixel(data, off, color);
                                off += 8;
                            }
                            off += 546 * 4 + 560 * 4;
                        }
                    }
                }
            }
        }
    }

    refresh() {
        let addr = 0x400 * this.page;
        this._refreshing = true;
        for (let idx = 0; idx < 0x400; idx++, addr++) {
            this._write(addr >> 8, addr & 0xff, this._buffer[0][idx], 0);
            if (_80colMode) {
                this._write(addr >> 8, addr & 0xff, this._buffer[1][idx], 1);
            }
        }
        this._refreshing = false;
    }

    blink() {
        let addr = 0x400 * this.page;
        this._refreshing = true;
        this._blink = !this._blink;
        for (let idx = 0; idx < 0x400; idx++, addr++) {
            const b = this._buffer[0][idx];
            if ((b & 0xC0) == 0x40) {
                this._write(addr >> 8, addr & 0xff, this._buffer[0][idx], 0);
            }
        }
        this._refreshing = false;
    }

    mono(on: boolean) {
        this._monoMode = on;
        this.refresh();
    }

    start() {
        setInterval(() => this.blink(), 267);
        return this._start();
    }

    end() {
        return this._end();
    }

    read(page: byte, off: byte) {
        return this._read(page, off, 0);
    }

    write(page: byte, off: byte, val: byte) {
        return this._write(page, off, val, 0);
    }

    getState(): GraphicsState {
        return {
            page: this.page,
            mono: this._monoMode,
            buffer: [
                base64_encode(this._buffer[0]),
                base64_encode(this._buffer[1])
            ]
        };
    }
    setState(state: GraphicsState) {
        this.page = state.page;
        this._monoMode = state.mono;
        this._buffer[0] = base64_decode(state.buffer[0]);
        this._buffer[1] = base64_decode(state.buffer[1]);

        this.refresh();
    }

    private mapCharCode(charCode: byte) {
        charCode &= 0x7F;
        if (charCode < 0x20) {
            charCode += 0x40;
        }
        if (!this.e && (charCode >= 0x60)) {
            charCode -= 0x40;
        }
        return charCode;
    }

    getText() {
        let buffer = '', line, charCode;
        let row, col, base;
        for (row = 0; row < 24; row++) {
            base = rowToBase(row);
            line = '';
            if (this.e && _80colMode) {
                for (col = 0; col < 80; col++) {
                    charCode = this.mapCharCode(this._buffer[1 - col % 2][base + Math.floor(col / 2)]);
                    line += String.fromCharCode(charCode);
                }
            } else {
                for (col = 0; col < 40; col++) {
                    charCode = this.mapCharCode(this._buffer[0][base + col]);
                    line += String.fromCharCode(charCode);
                }
            }
            line = line.trimRight();
            buffer += line + '\n';
        }
        return buffer;
    }
}

/****************************************************************************
 *
 * Hires Graphics
 *
 ***************************************************************************/

export class HiresPage2D implements HiresPage {
    public imageData: ImageData;

    private _dirty: Region = {
        top: 385,
        bottom: -1,
        left: 561,
        right: -1
    };

    private _buffer: memory[] = [];
    private _refreshing = false;

    private _monoMode = false;

    constructor(
        private page: number) {
        this.imageData = new ImageData(560, 384);
        for (let idx = 0; idx < 560 * 384 * 4; idx++) {
            this.imageData.data[idx] = 0xff;
        }
        this._buffer[0] = allocMemPages(0x20);
        this._buffer[1] = allocMemPages(0x20);
    }

    _drawPixel(data: Uint8ClampedArray, off: number, color: Color) {
        const c0 = color[0], c1 = color[1], c2 = color[2];

        data[off + 0] = data[off + 4] = c0;
        data[off + 1] = data[off + 5] = c1;
        data[off + 2] = data[off + 6] = c2;
        const nextOff = off + 560 * 4;
        data[nextOff] = data[nextOff + 4] = c0;
        data[nextOff + 1] = data[nextOff + 5] = c1;
        data[nextOff + 2] = data[nextOff + 6] = c2;
    }

    _drawHalfPixel(data: Uint8ClampedArray, off: number, color: Color) {
        const c0 = color[0], c1 = color[1], c2 = color[2];
        data[off + 0] = c0;
        data[off + 1] = c1;
        data[off + 2] = c2;
        const nextOff = off + 560 * 4;
        data[nextOff] = c0;
        data[nextOff + 1] = c1;
        data[nextOff + 2] = c2;
    }

    //
    // 160x192 pixels alternate 3 and 4 base pixels wide
    //

    _draw3Pixel(data: Uint8ClampedArray, off: number, color: Color) {
        const c0 = color[0], c1 = color[1], c2 = color[2];

        data[off + 0] = data[off + 4] = data[off + 8] = c0;
        data[off + 1] = data[off + 5] = data[off + 9] = c1;
        data[off + 2] = data[off + 6] = data[off + 10] = c2;
        const nextOff = off + 560 * 4;
        data[nextOff] = data[nextOff + 4] = data[nextOff + 8] = c0;
        data[nextOff + 1] = data[nextOff + 5] = data[nextOff + 9] = c1;
        data[nextOff + 2] = data[nextOff + 6] = data[nextOff + 10] = c2;
    }

    _draw4Pixel(data: Uint8ClampedArray, off: number, color: Color) {
        const c0 = color[0], c1 = color[1], c2 = color[2];

        data[off + 0] = data[off + 4] = data[off + 8] = data[off + 12] = c0;
        data[off + 1] = data[off + 5] = data[off + 9] = data[off + 13] = c1;
        data[off + 2] = data[off + 6] = data[off + 10] = data[off + 14] = c2;
        const nextOff = off + 560 * 4;
        data[nextOff] = data[nextOff + 4] = data[nextOff + 8] = data[nextOff + 12] = c0;
        data[nextOff + 1] = data[nextOff + 5] = data[nextOff + 9] = data[nextOff + 13] = c1;
        data[nextOff + 2] = data[nextOff + 6] = data[nextOff + 10] = data[nextOff + 14] = c2;
    }

    bank0(): Memory {
        return {
            start: () => this._start(),
            end: () => this._end(),
            read: (page, off) => this._read(page, off, 0),
            write: (page, off, val) => this._write(page, off, val, 0),
        };
    }

    bank1(): Memory {
        return {
            start: () => this._start(),
            end: () => this._end(),
            read: (page, off) => this._read(page, off, 1),
            write: (page, off, val) => this._write(page, off, val, 1),
        };
    }

    _start() { return (0x20 * this.page); }

    _end() { return (0x020 * this.page) + 0x1f; }

    _read(page: byte, off: byte, bank: bank) {
        const addr = (page << 8) | off, base = addr & 0x1FFF;
        return this._buffer[bank][base];
    }

    _write(page: byte, off: byte, val: byte, bank: bank) {
        const addr = (page << 8) | off;
        const base = addr & 0x1FFF;

        if (this._buffer[bank][base] == val && !this._refreshing) {
            return;
        }
        this._buffer[bank][base] = val;

        let hbs = val & 0x80;

        const col = (base % 0x80) % 0x28;
        const adj = off - col;

        // 000001cd eabab000 -> 000abcde
        const ab = (adj & 0x18);
        const cd = (page & 0x03) << 1;
        const e = adj >> 7;

        const rowa = ab | cd | e,
            rowb = base >> 10;

        const data = this.imageData.data;
        let dx, dy;
        if ((rowa < 24) && (col < 40)) {
            if (!multiScreen && !hiresMode) {
                return;
            }

            let y = rowa << 4 | rowb << 1;
            if (y < this._dirty.top) { this._dirty.top = y; }
            y += 2;
            if (y > this._dirty.bottom) { this._dirty.bottom = y; }
            let x = col * 14 - 2;
            if (x < this._dirty.left) { this._dirty.left = x; }
            x += 18;
            if (x > this._dirty.right) { this._dirty.right = x; }

            dy = rowa << 4 | rowb << 1;
            let bz, b0, b1, b2, b3, b4, c, hb;
            if (oneSixtyMode && !this._monoMode) {
                // 1 byte = two pixels, but 3:4 ratio
                const c3 = val & 0xf;
                const c4 = val >> 4;

                dx = col * 2 + (bank ^ 1);
                off = dx * 28 + dy * 280 * 4 * 2;

                this._draw3Pixel(data, off, dcolors[c3]);
                this._draw4Pixel(data, off + 12, dcolors[c4]);
            } else if (doubleHiresMode) {
                val &= 0x7f;

                // Every 4 bytes is 7 pixels
                // 2 bytes per bank

                // b0       b1       b2       b3
                //  c0  c1    c2  c3    c4  c5    c6
                // 76543210 76543210 76543210 76543210
                //  1111222  2333344  4455556  6667777

                const mod = col % 2, mcol = col - mod, baseOff = base - mod;
                bz = this._buffer[0][baseOff - 1];
                b0 = this._buffer[1][baseOff];
                b1 = this._buffer[0][baseOff];
                b2 = this._buffer[1][baseOff + 1];
                b3 = this._buffer[0][baseOff + 1];
                b4 = this._buffer[1][baseOff + 2];
                c = [
                    0,
                    ((b0 & 0x0f) >> 0), // 0
                    ((b0 & 0x70) >> 4) | ((b1 & 0x01) << 3), // 1
                    ((b1 & 0x1e) >> 1), // 2
                    ((b1 & 0x60) >> 5) | ((b2 & 0x03) << 2), // 3
                    ((b2 & 0x3c) >> 2), // 4
                    ((b2 & 0x40) >> 6) | ((b3 & 0x07) << 1), // 5
                    ((b3 & 0x78) >> 3), // 6
                    0
                ], // 7
                hb = [
                    0,
                    b0 & 0x80, // 0
                    b0 & 0x80, // 1
                    b1 & 0x80, // 2
                    b2 & 0x80, // 3
                    b2 & 0x80, // 4
                    b3 & 0x80, // 5
                    b3 & 0x80, // 6
                    0
                ]; // 7
                if (col > 0) {
                    c[0] = (bz & 0x78) >> 3;
                    hb[0] = bz & 0x80;
                }
                if (col < 39) {
                    c[8] = b4 & 0x0f;
                    hb[8] = b4 & 0x80;
                }
                dx = mcol * 14;
                off = dx * 4 + dy * 280 * 4 * 2;

                let monoColor = null;
                if (this._monoMode || monoDHRMode) {
                    monoColor = whiteCol;
                }

                for (let idx = 1; idx < 8; idx++) {
                    hbs = hb[idx];
                    const dcolor = dcolors[r4[c[idx]]];
                    let bits = c[idx - 1] | (c[idx] << 4) | (c[idx + 1] << 8);
                    for (let jdx = 0; jdx < 4; jdx++, off += 4) {
                        if (monoColor) {
                            if (bits & 0x10) {
                                this._drawHalfPixel(data, off, monoColor);
                            } else {
                                this._drawHalfPixel(data, off, blackCol);
                            }
                        } else if (mixedDHRMode) {
                            if (hbs) {
                                this._drawHalfPixel(data, off, dcolor);
                            } else {
                                if (bits & 0x10) {
                                    this._drawHalfPixel(data, off, whiteCol);
                                } else {
                                    this._drawHalfPixel(data, off, blackCol);
                                }
                            }
                        } else if (colorDHRMode) {
                            this._drawHalfPixel(data, off, dcolor);
                        } else if (
                            ((c[idx] != c[idx - 1]) && (c[idx] != c[idx + 1])) &&
                            (((bits & 0x1c) == 0x1c) ||
                                ((bits & 0x70) == 0x70) ||
                                ((bits & 0x38) == 0x38))
                        ) {
                            this._drawHalfPixel(data, off, whiteCol);
                        } else if (
                            (bits & 0x38) ||
                            (c[idx] == c[idx + 1]) ||
                            (c[idx] == c[idx - 1])
                        ) {
                            this._drawHalfPixel(data, off, dcolor);
                        } else if (bits & 0x28) {
                            this._drawHalfPixel(data, off, dim(dcolor));
                        } else {
                            this._drawHalfPixel(data, off, blackCol);
                        }
                        bits >>= 1;
                    }
                }

                if (!this._refreshing) {
                    this._refreshing = true;
                    const bb: bank = bank ? 0 : 1;
                    for (let rr = addr - 1; rr <= addr + 1; rr++) {
                        const vv = this._buffer[bb][rr - 0x2000 * this.page];
                        this._write(rr >> 8, rr & 0xff, vv, bb);
                    }
                    this._refreshing = false;
                }
            } else {
                val = this._buffer[0][base];
                hbs = val & 0x80;
                val &= 0x7f;
                dx = col * 14 - 2;
                b0 = col > 0 ? this._buffer[0][base - 1] : 0;
                b2 = col < 39 ? this._buffer[0][base + 1] : 0;
                val |= (b2 & 0x3) << 7;
                let v0 = b0 & 0x20, v1 = b0 & 0x40, v2 = val & 0x1,
                    odd = !(col & 0x1),
                    color;
                const oddCol = (hbs ? orangeCol : greenCol);
                const evenCol = (hbs ? blueCol : violetCol);

                off = dx * 4 + dy * 280 * 4 * 2;

                const monoColor = this._monoMode ? whiteCol : null;

                for (let idx = 0; idx < 9; idx++, off += 8) {
                    val >>= 1;

                    if (v1) {
                        if (monoColor) {
                            color = monoColor;
                        } else if (highColorHGRMode) {
                            color = dcolors[this._buffer[1][base] >> 4];
                        } else if (v0 || v2) {
                            color = whiteCol;
                        } else {
                            color = odd ? oddCol : evenCol;
                        }
                    } else {
                        if (monoColor) {
                            color = blackCol;
                        } else if (highColorHGRMode) {
                            color = dcolors[this._buffer[1][base] & 0x0f];
                        } else if (odd && v2 && v0) {
                            color = v0 ? dim(evenCol) : evenCol;
                        } else if (!odd && v0 && v2) {
                            color = v2 ? dim(oddCol) : oddCol;
                        } else {
                            color = blackCol;
                        }
                    }

                    if (dx > -1 && dx < 560) {
                        this._drawPixel(data, off, color);
                    }
                    dx += 2;

                    v0 = v1;
                    v1 = v2;
                    v2 = val & 0x01;
                    odd = !odd;
                }
            }
        }
    }

    refresh() {
        let addr = 0x2000 * this.page;
        this._refreshing = true;
        for (let idx = 0; idx < 0x2000; idx++, addr++) {
            const page = addr >> 8;
            const off = addr & 0xff;
            this._write(page, off, this._buffer[0][idx], 0);
            if (_80colMode) {
                this._write(page, off, this._buffer[1][idx], 1);
            }
        }
        this._refreshing = false;
    }

    mono(on: boolean) {
        this._monoMode = on;
        this.refresh();
    }

    start() {
        return this._start();
    }

    end() {
        return this._end();
    }

    read(page: byte, off: byte) {
        return this._read(page, off, 0);
    }

    write(page: byte, off: byte, val: byte) {
        return this._write(page, off, val, 0);
    }

    getState(): GraphicsState {
        return {
            page: this.page,
            mono: this._monoMode,
            buffer: [
                base64_encode(this._buffer[0]),
                base64_encode(this._buffer[1])
            ]
        };
    }

    setState(state: GraphicsState) {
        this.page = state.page;
        this._monoMode = state.mono;
        this._buffer[0] = base64_decode(state.buffer[0]);
        this._buffer[1] = base64_decode(state.buffer[1]);

        this.refresh();
    }
}

export class VideoModes2D implements VideoModes {
    private _grs: LoresPage[];
    private _hgrs: HiresPage[];
    private _flag = 0;
    private _context: CanvasRenderingContext2D | null;

    public ready = Promise.resolve();

    constructor(
        gr: LoresPage,
        hgr: HiresPage,
        gr2: LoresPage,
        hgr2: HiresPage,
        private canvas: HTMLCanvasElement,
        private e: boolean) {
        this._grs = [gr, gr2];
        this._hgrs = [hgr, hgr2];
        this._context = this.canvas.getContext('2d');
    }

    private _refresh() {
        highColorTextMode = !an3 && textMode && !_80colMode;
        highColorHGRMode = !an3 && hiresMode && !_80colMode;
        doubleHiresMode = !an3 && hiresMode && _80colMode;
        oneSixtyMode = this._flag == 1 && doubleHiresMode;
        mixedDHRMode = this._flag == 2 && doubleHiresMode;
        monoDHRMode = this._flag == 3 && doubleHiresMode;

        this._grs[0].refresh();
        this._grs[1].refresh();
        this._hgrs[0].refresh();
        this._hgrs[1].refresh();
    }

    refresh() {
        this._refresh();
    }

    reset() {
        textMode = true;
        mixedMode = false;
        hiresMode = true;
        pageMode = 1;

        _80colMode = false;
        altCharMode = false;

        this._flag = 0;
        an3 = true;

        this._refresh();
    }

    text(on: boolean) {
        const old = textMode;
        textMode = on;

        if (old != on) {
            this._refresh();
        }
    }

    _80col(on: boolean) {
        if (!this.e) { return; }

        const old = _80colMode;
        _80colMode = on;

        if (old != on) {
            this._refresh();
        }
    }

    altchar(on: boolean) {
        if (!this.e) { return; }

        const old = altCharMode;
        altCharMode = on;
        if (old != on) {
            this._refresh();
        }
    }

    hires(on: boolean) {
        const old = hiresMode;
        hiresMode = on;
        if (!on) {
            this._flag = 0;
        }

        if (old != on) {
            this._refresh();
        }
    }

    an3(on: boolean) {
        if (!this.e) { return; }

        const old = an3;
        an3 = on;

        if (on) {
            this._flag = ((this._flag << 1) | (_80colMode ? 0x0 : 0x1)) & 0x3;
        }

        if (old != on) {
            this._refresh();
        }
    }

    doubleHires(on: boolean) {
        this.an3(!on);
    }

    mixed(on: boolean) {
        const old = mixedMode;
        mixedMode = on;
        if (old != on) {
            this._refresh();
        }
    }

    page(pageNo: pageNo) {
        const old = pageMode;
        pageMode = pageNo;
        if (old != pageNo) {
            this._refresh();
        }
    }

    enhanced(on: boolean) {
        enhanced = on;
    }

    multiScreen(on: boolean) {
        multiScreen = on;
    }

    isText() {
        return textMode;
    }

    isMixed() {
        return mixedMode;
    }

    isPage2() {
        return pageMode == 2;
    }

    isHires() {
        return hiresMode;
    }

    isDoubleHires() {
        return doubleHiresMode;
    }

    is80Col() {
        return _80colMode;
    }

    isAltChar() {
        return altCharMode;
    }

    updateImage(mainData: ImageData, mixData?: ImageData | null) {
        if (!this._context) {
            throw new Error('No 2D context');
        }
        if (mixData) {
            this._context.putImageData(mainData, 0, 0, 0, 0, 560, 160);
            this._context.putImageData(mixData, 0, 0, 0, 160, 560, 32);
        } else {
            this._context.putImageData(mainData, 0, 0);
        }
        return true;
    }

    blit() {
        let blitted = false;
        if (hiresMode && !textMode) {
            blitted = this.updateImage(
                this._hgrs[pageMode - 1].imageData,
                mixedMode ? this._grs[pageMode - 1].imageData : null
            );
        } else {
            blitted = this.updateImage(
                this._grs[pageMode - 1].imageData
            );
        }
        return blitted;
    }

    getState() {
        return {
            grs: [this._grs[0].getState(), this._grs[1].getState()],
            hgrs: [this._hgrs[0].getState(), this._hgrs[1].getState()],
            textMode: textMode,
            mixedMode: mixedMode,
            hiresMode: hiresMode,
            pageMode: pageMode,
            _80colMode: _80colMode,
            altCharMode: altCharMode,
            an3: an3
        } as VideoModesState;
    }

    setState(state: VideoModesState) {
        textMode = state.textMode;
        mixedMode = state.mixedMode;
        hiresMode = state.hiresMode;
        pageMode = state.pageMode;
        _80colMode = state._80colMode;
        altCharMode = state.altCharMode;
        an3 = state.an3;

        this._grs[0].setState(state.grs[0]);
        this._grs[1].setState(state.grs[1]);
        this._hgrs[0].setState(state.hgrs[0]);
        this._hgrs[1].setState(state.hgrs[1]);
    }

    mono(on: boolean) {
        this._grs[0].mono(on);
        this._grs[1].mono(on);
        this._hgrs[0].mono(on);
        this._hgrs[1].mono(on);
    }

    getText() {
        return this._grs[pageMode - 1].getText();
    }
}
