/* Copyright 2010-2021 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

import { byte, Color, memory, MemoryPages, rom } from './types';
import { allocMemPages } from './util';

import { screenEmu } from 'apple2shader';

import {
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
let textMode = true;
let mixedMode = false;
let hiresMode = false;
let pageMode: pageNo = 1;
let _80colMode = false;
let altCharMode = false;
let an3 = false;
let doubleHiresMode = false;

const tmpCanvas = document.createElement('canvas');
const tmpContext = tmpCanvas.getContext('2d');

const buildScreen = (mainData: ImageData, mixData?: ImageData | null) => {
    if (!tmpContext) {
        throw new Error('No webgl context');
    }

    const details = screenEmu.C.NTSC_DETAILS;
    const { width, height } = details.imageSize;
    const { x, y } = _80colMode ? details.topLeft80Col : details.topLeft;

    tmpCanvas.width = width;
    tmpCanvas.height = height;
    tmpContext.fillStyle = 'rgba(0,0,0,1)';
    tmpContext.fillRect(0, 0, width, height);

    if (mixData) {
        tmpContext.putImageData(mainData, x, y, 0, 0, 560, 160);
        tmpContext.putImageData(mixData, x, y, 0, 160, 560, 32);
    } else {
        tmpContext.putImageData(mainData, x, y);
    }
    return tmpContext.getImageData(0, 0, width, height);
};

// Color constants
const whiteCol: Color = [255, 255, 255];
const blackCol: Color = [0, 0, 0];

const notDirty: Region = {
    top: 385,
    bottom: -1,
    left: 561,
    right: -1
};

/****************************************************************************
 *
 * Text/Lores Graphics
 *
 ***************************************************************************/

export class LoresPageGL implements LoresPage {
    // $00-$3F inverse
    // $40-$7F flashing
    // $80-$FF normal

    private _buffer: memory[] = [];
    private _monoMode = false;
    private _refreshing = false;
    private _blink = false;

    dirty: Region = {...notDirty}
    imageData: ImageData;

    constructor(private page: number,
        private readonly charset: rom,
        private readonly e: boolean) {
        this.imageData = new ImageData(560, 192);
        for (let idx = 0; idx < 560 * 192 * 4; idx++) {
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
    }

    _drawHalfPixel(data: Uint8ClampedArray, off: number, color: Color) {
        const c0 = color[0], c1 = color[1], c2 = color[2];
        data[off + 0] = c0;
        data[off + 1] = c1;
        data[off + 2] = c2;
    }

    bank0(): MemoryPages {
        return {
            start: () => this._start(),
            end: () => this._end(),
            read: (page, off) => this._read(page, off, 0),
            write: (page, off, val) => this._write(page, off, val, 0),
        };
    }

    bank1(): MemoryPages {
        return {
            start: () => this._start(),
            end: () => this._end(),
            read: (page, off) => this._read(page, off, 1),
            write: (page, off, val) => this._write(page, off, val, 1),
        };
    }

    // These are used by both bank 0 and 1

    private _start() {
        return (0x04 * this.page);
    }

    private _end() { return (0x04 * this.page) + 0x03; }

    private _read(page: byte, off: byte, bank: bank) {
        const addr = (page << 8) | off, base = addr & 0x3FF;
        return this._buffer[bank][base];
    }

    private _write(page: byte, off: byte, val: byte, bank: bank) {
        const addr = (page << 8) | off;
        const base = addr & 0x3FF;
        let fore, back;

        if (this._buffer[bank][base] == val && !this._refreshing) {
            return;
        }
        this._buffer[bank][base] = val;

        if (!_80colMode && bank === 1) {
            return;
        }

        const col = (base % 0x80) % 0x28;
        const adj = off - col;

        // 000001cd eabab000 -> 000abcde
        const ab = (adj & 0x18);
        const cd = (page & 0x03) << 1;
        const ee = adj >> 7;
        const row = ab | cd | ee;

        const data = this.imageData.data;
        if ((row < 24) && (col < 40)) {
            let y = row << 3;
            if (y < this.dirty.top) { this.dirty.top = y; }
            y += 8;
            if (y > this.dirty.bottom) { this.dirty.bottom = y; }
            let x = col * 14;
            if (x < this.dirty.left) { this.dirty.left = x; }
            x += 14;
            if (x > this.dirty.right) { this.dirty.right = x; }

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
                if (_80colMode && !an3) {
                    let offset = (col * 14 + (bank ? 0 : 1) * 7 + row * 560 * 8) * 4;
                    for (let jdx = 0; jdx < 8; jdx++) {
                        let b = (jdx < 4) ? (val & 0x0f) : (val >> 4);
                        b |= (b << 4);
                        b |= (b << 8);
                        if (col & 0x1) {
                            b >>= 2;
                        }
                        for (let idx = 0; idx < 7; idx++) {
                            const color = (b & 0x01) ? whiteCol : blackCol;
                            this._drawHalfPixel(data, offset, color);
                            b >>= 1;
                            offset += 4;
                        }
                        offset += 553 * 4;
                    }
                } else {
                    let offset = (col * 14 + row * 560 * 8) * 4;
                    for (let jdx = 0; jdx < 8; jdx++) {
                        let b = (jdx < 4) ? (val & 0x0f) : (val >> 4);
                        b |= (b << 4);
                        b |= (b << 8);
                        if (col & 0x1) {
                            b >>= 2;
                        }
                        for (let idx = 0; idx < 14; idx++) {
                            const color = (b & 0x0001) ? whiteCol : blackCol;
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

    mono(on: boolean) {
        this._monoMode = on;
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
                new Uint8Array(this._buffer[0]),
                new Uint8Array(this._buffer[1]),
            ]
        };
    }

    setState(state: GraphicsState) {
        this.page = state.page;
        this._buffer[0] = new Uint8Array(state.buffer[0]);
        this._buffer[1] = new Uint8Array(state.buffer[1]);

        this.refresh();
    }

    private rowToBase(row: number) {
        const ab = (row >> 3) & 3;
        const cd = (row >> 1) & 0x3;
        const e = row & 1;
        return (cd << 8) | (e << 7) | (ab << 5) | (ab << 3);
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
            base = this.rowToBase(row);
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

export class HiresPageGL implements HiresPage {

    private _buffer: memory[] = [];
    private _refreshing = false;
    private _monoMode = false;

    dirty: Region = {
        top: 193,
        bottom: -1,
        left: 561,
        right: -1
    };
    imageData: ImageData;

    constructor(
        private page: number) {
        this.imageData = new ImageData(560, 192);
        for (let idx = 0; idx < 560 * 192 * 4; idx++) {
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
    }

    _drawHalfPixel(data: Uint8ClampedArray, off: number, color: Color) {
        const c0 = color[0], c1 = color[1], c2 = color[2];

        data[off + 0] = c0;
        data[off + 1] = c1;
        data[off + 2] = c2;
    }

    bank0(): MemoryPages {
        return {
            start: () => this._start(),
            end: () => this._end(),
            read: (page, off) => this._read(page, off, 0),
            write: (page, off, val) => this._write(page, off, val, 0),
        };
    }

    bank1(): MemoryPages {
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

        const data = this.imageData.data;
        let dx, dy;
        if ((rowa < 24) && (col < 40)) {
            if (!hiresMode) {
                return;
            }

            let y = rowa << 3 | rowb;
            if (y < this.dirty.top) { this.dirty.top = y; }
            y += 1;
            if (y > this.dirty.bottom) { this.dirty.bottom = y; }
            let x = col * 14 - 2;
            if (x < this.dirty.left) { this.dirty.left = x; }
            x += 18;
            if (x > this.dirty.right) { this.dirty.right = x; }

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

    mono(on: boolean) {
        this._monoMode = on;
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
                new Uint8Array(this._buffer[0]),
                new Uint8Array(this._buffer[1]),
            ]
        };
    }

    setState(state: GraphicsState) {
        this.page = state.page;
        this._buffer[0] = new Uint8Array(state.buffer[0]);
        this._buffer[1] = new Uint8Array(state.buffer[1]);

        this.refresh();
    }
}

export class VideoModesGL implements VideoModes {
    private _grs: LoresPage[];
    private _hgrs: HiresPage[];
    private _sv: any;
    private _displayConfig: screenEmu.DisplayConfiguration;
    private _monoMode: boolean = false;

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

        this._displayConfig = this.defaultMonitor();
        this._sv.displayConfiguration = this._displayConfig;
    }

    private defaultMonitor(): screenEmu.DisplayConfiguration {
        let config = new screenEmu.DisplayConfiguration();
        config.displayResolution = new screenEmu.Size(this.canvas.width, this.canvas.height);
        config.displayResolution = new screenEmu.Size(this.canvas.width, this.canvas.height);
        config.displayScanlineLevel = 0.5;
        config.videoWhiteOnly = true;
        config.videoSaturation = 0.8;
        config.videoSize = new screenEmu.Size(1.25, 1.15);
        config.videoCenter = new screenEmu.Point(0.01, 0.02);
        // config.videoDecoder = 'CANVAS_CXA2025AS';
        return config;
    }

    private monitorII(): screenEmu.DisplayConfiguration {
        // Values taken from openemulator/libemulation/res/library/Monitors/Apple Monitor II.xml
        let config = new screenEmu.DisplayConfiguration();
        config.displayResolution = new screenEmu.Size(this.canvas.width, this.canvas.height);
        config.displayResolution = new screenEmu.Size(this.canvas.width, this.canvas.height);
        config.videoDecoder = 'CANVAS_MONOCHROME';
        config.videoBrightness = 0.15;
        config.videoContrast = 0.8;
        config.videoSaturation = 1.45;
        config.videoHue = 0.27;
        config.videoCenter = new screenEmu.Point(0, 0);
        config.videoSize = new screenEmu.Size(1.05, 1.05);
        config.videoBandwidth = 6000000;
        config.displayBarrel = 0.1;
        config.displayScanlineLevel = 0.5;
        config.displayCenterLighting = 0.5;
        config.displayLuninanceGain = 1.5;
        return config;
    }

    private _refresh() {
        doubleHiresMode = !an3 && hiresMode && _80colMode;

        this._grs[0].refresh();
        this._grs[1].refresh();
        this._hgrs[0].refresh();
        this._hgrs[1].refresh();

        if (this._displayConfig) {
            this._displayConfig.videoWhiteOnly = textMode || this._monoMode;
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

        if (old != on) {
            this._refresh();
        }
    }

    an3(on: boolean) {
        if (!this.e) { return; }

        const old = an3;
        an3 = on;

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

    updateImage(
        mainData: ImageData,
        mainDirty: Region,
        mixData?: ImageData | null,
        mixDirty?: Region | null
    ) {
        let blitted = false;
        if (mainDirty.bottom !== -1 || (mixDirty && mixDirty.bottom !== -1)) {
            const imageData = buildScreen(mainData, mixData);
            const imageInfo = new screenEmu.ImageInfo(imageData);
            this._sv.image = imageInfo;
            blitted = true;
        }
        this._sv.vsync();
        return blitted;
    }

    blit(altData?: ImageData) {
        let blitted = false;
        const hgr = this._hgrs[pageMode - 1];
        const gr = this._grs[pageMode - 1];

        if (altData) {
            blitted = this.updateImage(
                altData,
                { top: 0, left: 0, right: 560, bottom: 384 }
            );
        } else if (hiresMode && !textMode) {
            blitted = this.updateImage(
                hgr.imageData, hgr.dirty,
                mixedMode ? gr.imageData : null, mixedMode ? gr.dirty : null,
            );
        } else {
            blitted = this.updateImage(
                gr.imageData, gr.dirty
            );
        }
        hgr.dirty = {...notDirty};
        gr.dirty = {...notDirty};

        return blitted;
    }

    getState(): VideoModesState {
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
        };
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
        this._refresh();
    }

    mono(on: boolean) {
        this._grs[0].mono(on);
        this._grs[1].mono(on);
        this._hgrs[0].mono(on);
        this._hgrs[1].mono(on);

        this._monoMode = on;
        this._displayConfig = on ? this.monitorII() : this.defaultMonitor();
        this._refresh();
    }

    getText() {
        return this._grs[pageMode - 1].getText();
    }
}
