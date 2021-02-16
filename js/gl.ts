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
import { byte, memory, Memory, Restorable } from './types';
import { allocMemPages } from './util';

import { screenEmu } from './contrib/screenEmu';

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

type bank = 0 | 1;
type pageNo = 1 | 2;

interface Color {
    0: byte, // red
    1: byte, // green
    2: byte, // blue
}

interface Region {
    top: number,
    bottom: number,
    left: number,
    right: number,
}


interface GLGraphicsState {
    page: byte;
    buffer: string[];
}

interface VideoModesState {
    grs: [gr1: GLGraphicsState, _gr2: GLGraphicsState],
    hgrs: [hgr1: GLGraphicsState, hgr2: GLGraphicsState],
    textMode: boolean,
    mixedMode: boolean,
    hiresMode: boolean,
    pageMode: pageNo,
    _80colMode: boolean,
    altCharMode: boolean,
    an3: boolean,
}

function rowToBase(row: number) {
    const ab = (row >> 3) & 3;
    const cd = (row >> 1) & 0x3;
    const e = row & 1;
    return (cd << 8) | (e << 7) | (ab << 5) | (ab << 3);
}


// hires colors
const whiteCol: Color = [255, 255, 255];
const blackCol: Color = [0, 0, 0];

/****************************************************************************
 *
 * Text/Lores Graphics
 *
 ***************************************************************************/

export class LoresPage implements Memory, Restorable<GLGraphicsState> {
    // $00-$3F inverse
    // $40-$7F flashing
    // $80-$FF normal

    private _imageData: ImageData;
    private _buffer: memory[] = [];
    private _refreshing = false;
    private _blink = false;
    private _dirty: Region = {
        top: 193,
        bottom: -1,
        left: 561,
        right: -1
    };

    constructor(private page: number,
        private readonly charset: memory,
        private readonly e: boolean) {
        this._imageData = new ImageData(560, 192);
        for (let idx = 0; idx < 560 * 192 * 4; idx++) {
            this._imageData.data[idx] = 0xff;
        }
        this._buffer[0] = allocMemPages(0x4);
        this._buffer[1] = allocMemPages(0x4);
    }

    _drawPixel(data: Uint8ClampedArray, off: number, color: Color) {
        const c0 = color[0], c1 = color[1], c2 = color[2];
        data[off + 0] = data[off + 4] = c0;
        data[off + 1] = data[off + 5] = c1;
        data[off + 2] = data[off + 6] = c2;
    }

    _drawHalfPixel(data: Uint8ClampedArray, off: number, color: Color) {
        const c0 = color[0], c1 = color[1], c2 = color[2];
        data[off + 0] = c0;
        data[off + 1] = c1;
        data[off + 2] = c2;
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

        const data = this._imageData.data;
        if ((row < 24) && (col < 40)) {
            let y = row << 3;
            if (y < this._dirty.top) { this._dirty.top = y; }
            y += 8;
            if (y > this._dirty.bottom) { this._dirty.bottom = y; }
            let x = col * 14;
            if (x < this._dirty.left) { this._dirty.left = x; }
            x += 14;
            if (x > this._dirty.right) { this._dirty.right = x; }

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

                    let offset = (col * 14 + (bank ? 0 : 1) * 7 + row * 560 * 8) * 4;

                    for (let jdx = 0; jdx < 8; jdx++) {
                        let b = this.charset[val * 8 + jdx];
                        for (let idx = 0; idx < 7; idx++) {
                            const color = (b & 0x01) ? back : fore;
                            this._drawHalfPixel(data, offset, color);
                            b >>= 1;
                            offset += 4;
                        }
                        offset += 553 * 4;
                    }
                } else {
                    val = this._buffer[0][base];

                    if (!enhanced) {
                        val = (val >= 0x40 && val < 0x60) ? val - 0x40 : val;
                    } else if (!altCharMode) {
                        val = (val >= 0x40 && val < 0x80) ? val - 0x40 : val;
                    }

                    let offset = (col * 14 + row * 560 * 8) * 4;

                    if (this.e) {
                        for (let jdx = 0; jdx < 8; jdx++) {
                            let b = this.charset[val * 8 + jdx];
                            for (let idx = 0; idx < 7; idx++) {
                                const color = (b & 0x01) ? back : fore;
                                this._drawPixel(data, offset, color);
                                b >>= 1;
                                offset += 8;
                            }
                            offset += 546 * 4;
                        }
                    } else {
                        for (let jdx = 0; jdx < 8; jdx++) {
                            let b = this.charset[val * 8 + jdx] << 1;

                            for (let idx = 0; idx < 7; idx++) {
                                const color = (b & 0x80) ? fore : back;
                                this._drawPixel(data, offset, color);
                                b <<= 1;
                                offset += 8;
                            }
                            offset += 546 * 4;
                        }
                    }
                }
            } else {
                if (!_80colMode && bank == 1) {
                    return;
                }
                if (_80colMode && !an3) {
                    let offset = (col * 14 + (bank ? 0 : 1) * 7 + row * 560 * 8) * 4;
                    fore = whiteCol;
                    back = blackCol;
                    for (let jdx = 0; jdx < 8; jdx++) {
                        let b = (jdx < 8) ? (val & 0x0f) : (val >> 4);
                        b |= (b << 4);
                        if (bank & 0x1) {
                            b <<= 1;
                        }
                        for (let idx = 0; idx < 7; idx++) {
                            const color = (b & 0x80) ? fore : back;
                            this._drawHalfPixel(data, offset, color);
                            b <<= 1;
                            offset += 4;
                        }
                        offset += 553 * 4;
                    }
                } else {
                    let offset = (col * 14 + row * 560 * 8) * 4;

                    fore = whiteCol;
                    back = blackCol;
                    for (let jdx = 0; jdx < 8; jdx++) {
                        let b = (jdx < 4) ? (val & 0x0f) : (val >> 4);
                        b |= (b << 4);
                        b |= (b << 8);
                        if (col & 0x1) {
                            b >>= 2;
                        }
                        for (let idx = 0; idx < 14; idx++) {
                            const color = (b & 0x0001) ? fore : back;
                            this._drawHalfPixel(data, offset, color);
                            b >>= 1;
                            offset += 4;
                        }
                        offset += 546 * 4;
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

    blit(_sv: any, _mixed: boolean = false): boolean {
        if (this._dirty.top === 193) { return false; }

        // let top = this._dirty.top;
        // const bottom = this._dirty.bottom;
        // const left = this._dirty.left;
        // const right = this._dirty.right;

        // if (mixed) {
        //     if (bottom < 160) { return false; }
        //     if (top < 160) { top = 160; }
        // }
        // this.context.putImageData(
        //     this._imageData, 0, 0, left, top, right - left, bottom - top
        // );

        const [, imageData] = screenEmu.screenData(
            this._imageData,
            screenEmu.C.NTSC_DETAILS,
            doubleHiresMode
        );
        const imageInfo = new screenEmu.ImageInfo(imageData);
        _sv.image = imageInfo;
        _sv.vsync();

        this._dirty = {
            top: 193,
            bottom: -1,
            left: 561,
            right: -1
        };

        return true;
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

    getState(): GLGraphicsState {
        return {
            page: this.page,
            buffer: [
                base64_encode(this._buffer[0]),
                base64_encode(this._buffer[1])
            ]
        };
    }
    setState(state: GLGraphicsState) {
        this.page = state.page;
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

export class HiresPage implements Memory, Restorable<GLGraphicsState> {
    private _imageData: ImageData;
    private _dirty: Region = {
        top: 193,
        bottom: -1,
        left: 561,
        right: -1
    };

    private _buffer: memory[] = [];
    private _refreshing = false;

    constructor(
        private page: number) {
        this._imageData = new ImageData(560, 192);
        for (let idx = 0; idx < 560 * 192 * 4; idx++) {
            this._imageData.data[idx] = 0xff;
        }
        this._buffer[0] = allocMemPages(0x20);
        this._buffer[1] = allocMemPages(0x20);
    }

    _drawPixel(data: Uint8ClampedArray, off: number, color: Color) {
        const c0 = color[0], c1 = color[1], c2 = color[2];

        data[off + 0] = data[off + 4] = c0;
        data[off + 1] = data[off + 5] = c1;
        data[off + 2] = data[off + 6] = c2;
    }

    _drawHalfPixel(data: Uint8ClampedArray, off: number, color: Color) {
        const c0 = color[0], c1 = color[1], c2 = color[2];

        data[off + 0] = c0;
        data[off + 1] = c1;
        data[off + 2] = c2;
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

        // let hbs = val & 0x80;

        const col = (base % 0x80) % 0x28;
        const adj = off - col;

        // 000001cd eabab000 -> 000abcde
        const ab = (adj & 0x18);
        const cd = (page & 0x03) << 1;
        const e = adj >> 7;

        const rowa = ab | cd | e,
            rowb = base >> 10;

        const data = this._imageData.data;
        let dx, dy;
        if ((rowa < 24) && (col < 40)) {
            if (!multiScreen && !hiresMode) {
                return;
            }

            let y = rowa << 3 | rowb;
            if (y < this._dirty.top) { this._dirty.top = y; }
            y += 1;
            if (y > this._dirty.bottom) { this._dirty.bottom = y; }
            let x = col * 14 - 2;
            if (x < this._dirty.left) { this._dirty.left = x; }
            x += 18;
            if (x > this._dirty.right) { this._dirty.right = x; }

            dy = rowa << 3 | rowb;
            let bz, b0, b1, b2, b3, b4, c, hb;
            if (doubleHiresMode) {
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
                let offset = dx * 4 + dy * 280 * 4 * 2;

                for (let idx = 1; idx < 8; idx++) {
                    // hbs = hb[idx];
                    let bits = c[idx - 1] | (c[idx] << 4) | (c[idx + 1] << 8);
                    for (let jdx = 0; jdx < 4; jdx++, offset += 4) {
                        if (bits & 0x10) {
                            this._drawHalfPixel(data, offset, whiteCol);
                        } else {
                            this._drawHalfPixel(data, offset, blackCol);
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
                const hbs = val & 0x80;
                val &= 0x7f;
                dx = col * 14 - 2;
                b0 = col > 0 ? this._buffer[0][base - 1] : 0;
                b2 = col < 39 ? this._buffer[0][base + 1] : 0;
                val |= (b2 & 0x3) << 7;
                let v1 = b0 & 0x40,
                    v2 = val & 0x1,
                    color;

                let offset = dx * 4 + dy * 560 * 4 + (hbs ? 4 : 0);

                for (let idx = 0; idx < 9; idx++, offset += 8) {
                    val >>= 1;

                    if (v1) {
                        color = whiteCol;
                    } else {
                        color = blackCol;
                    }

                    if (dx > -1 && dx < 560) {
                        this._drawPixel(data, offset, color);
                    }
                    dx += 2;

                    v1 = v2;
                    v2 = val & 0x01;
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

    blit(_sv: any, _mixed: boolean = false) {
        if (this._dirty.top === 193) { return false; }
        // const top = this._dirty.top;
        // let bottom = this._dirty.bottom;
        // const left = this._dirty.left;
        // const right = this._dirty.right;

        // if (mixed) {
        //     if (top > 160) { return false; }
        //     if (bottom > 160) { bottom = 160; }
        // }
        // this.context.putImageData(
        //     this._imageData, 0, 0, left, top, right - left, bottom - top
        // );

        const [, imageData] = screenEmu.screenData(
            this._imageData,
            screenEmu.C.NTSC_DETAILS,
            doubleHiresMode
        );
        const imageInfo = new screenEmu.ImageInfo(imageData);
        _sv.image = imageInfo;
        _sv.vsync();

        this._dirty = {
            top: 193,
            bottom: -1,
            left: 561,
            right: -1
        };
        return true;
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

    getState(): GLGraphicsState {
        return {
            page: this.page,
            buffer: [
                base64_encode(this._buffer[0]),
                base64_encode(this._buffer[1])
            ]
        };
    }

    setState(state: GLGraphicsState) {
        this.page = state.page;
        this._buffer[0] = base64_decode(state.buffer[0]);
        this._buffer[1] = base64_decode(state.buffer[1]);

        this.refresh();
    }
}

export class VideoModes implements Restorable<VideoModesState> {
    private _grs: LoresPage[];
    private _hgrs: HiresPage[];
    private _flag = 0;
    private _sv: any;
    private _displayConfig: any;

    ready: Promise<void>

    constructor(
        gr: LoresPage,
        hgr: HiresPage,
        gr2: LoresPage,
        hgr2: HiresPage,
        private canvas: HTMLCanvasElement,
        private e: boolean) {
        this._grs = [gr, gr2];
        this._hgrs = [hgr, hgr2];
        this._sv = new screenEmu.ScreenView(this.canvas);

        this.ready = this.init();
    }

    async init() {
        await this._sv.initOpenGL();

        (window as any)._sv = this._sv;

        this._displayConfig = new screenEmu.DisplayConfiguration();
        this._displayConfig.displayResolution = new screenEmu.Size(this.canvas.width, this.canvas.height);
        this._displayConfig.displayResolution = new screenEmu.Size(this.canvas.width, this.canvas.height);
        this._displayConfig.displayScanlineLevel = 0.5;
        this._displayConfig.videoWhiteOnly = true;
        this._displayConfig.videoSize = new screenEmu.Size(1.25, 1.15);
        this._displayConfig.videoCenter = new screenEmu.Point(0.01, 0.02);
        // this._displayConfig.videoDecoder = 'CANVAS_CXA2025AS';
        this._sv.displayConfiguration = this._displayConfig;
    }

    private _refresh() {
        doubleHiresMode = !an3 && hiresMode && _80colMode;

        this._grs[0].refresh();
        this._grs[1].refresh();
        this._hgrs[0].refresh();
        this._hgrs[1].refresh();

        if (this._displayConfig) {
            this._displayConfig.videoWhiteOnly = textMode;
            this._sv.displayConfiguration = this._displayConfig;
        }
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

    blit() {
        let blitted = false;
        if (multiScreen) {
            blitted = this._grs[0].blit(this._sv) || blitted;
            blitted = this._grs[1].blit(this._sv) || blitted;
            blitted = this._hgrs[0].blit(this._sv) || blitted;
            blitted = this._hgrs[1].blit(this._sv) || blitted;
        } else {
            if (hiresMode && !textMode) {
                if (mixedMode) {
                    blitted = this._grs[pageMode - 1].blit(this._sv, true) || blitted;
                    blitted = this._hgrs[pageMode - 1].blit(this._sv, true) || blitted;
                } else {
                    blitted = this._hgrs[pageMode - 1].blit(this._sv);
                }
            } else {
                blitted = this._grs[pageMode - 1].blit(this._sv);
            }
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

    getText() {
        return this._grs[pageMode - 1].getText();
    }
}
