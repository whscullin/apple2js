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

// Color constants
const whiteCol: Color = [255, 255, 255];
const blackCol: Color = [0, 0, 0];

const notDirty: Region = {
    top: 193,
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
    private _refreshing = false;
    private _blink = false;

    dirty: Region = {...notDirty};
    imageData: ImageData;

    constructor(
        private vm: VideoModes,
        private page: pageNo,
        private readonly charset: rom,
        private readonly e: boolean
    ) {
        this.imageData = this.vm.context.createImageData(560, 192);
        this.imageData.data.fill(0xff);
        this._buffer[0] = allocMemPages(0x4);
        this._buffer[1] = allocMemPages(0x4);

        this.vm.setLoresPage(page, this);
    }

    private _drawPixel(data: Uint8ClampedArray, off: number, color: Color) {
        const c0 = color[0], c1 = color[1], c2 = color[2];
        data[off + 0] = data[off + 4] = c0;
        data[off + 1] = data[off + 5] = c1;
        data[off + 2] = data[off + 6] = c2;
    }

    private _drawHalfPixel(data: Uint8ClampedArray, off: number, color: Color) {
        const c0 = color[0], c1 = color[1], c2 = color[2];
        data[off + 0] = c0;
        data[off + 1] = c1;
        data[off + 2] = c2;
    }

    private _checkInverse(val: byte) {
        let inverse = false;
        if (this.e) {
            if (!this.vm._80colMode && !this.vm.altCharMode) {
                inverse = ((val & 0xc0) == 0x40) && this._blink;
            }
        } else {
            inverse = !((val & 0x80) || (val & 0x40) && this._blink);
        }
        return inverse;
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

            if (this.vm.textMode || this.vm.hiresMode || (this.vm.mixedMode && row > 19)) {
                if (this.vm._80colMode) {
                    const inverse = this._checkInverse(val);

                    fore = inverse ? blackCol : whiteCol;
                    back = inverse ? whiteCol : blackCol;

                    if (!this.vm.altCharMode) {
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
                } else if (bank === 0) {
                    val = this._buffer[0][base];

                    const inverse = this._checkInverse(val);

                    fore = inverse ? blackCol : whiteCol;
                    back = inverse ? whiteCol : blackCol;

                    if (!this.vm.altCharMode) {
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
                if (this.vm._80colMode && !this.vm.an3State) {
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
                } else if (bank === 0) {
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
            if (this.vm._80colMode) {
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
            buffer: [
                new Uint8Array(this._buffer[0]),
                new Uint8Array(this._buffer[1]),
            ]
        };
    }

    setState(state: GraphicsState) {
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
            if (this.e && this.vm._80colMode) {
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
    public imageData: ImageData;
    dirty: Region = {...notDirty};

    private _buffer: memory[] = [];
    private _refreshing = false;

    constructor(
        private vm: VideoModes,
        private page: pageNo,
    ) {
        this.imageData = this.vm.context.createImageData(560, 192);
        this.imageData.data.fill(0xff);
        this._buffer[0] = allocMemPages(0x20);
        this._buffer[1] = allocMemPages(0x20);

        this.vm.setHiresPage(page, this);
    }

    private _drawPixel(data: Uint8ClampedArray, off: number, color: Color) {
        const c0 = color[0], c1 = color[1], c2 = color[2];

        data[off + 0] = data[off + 4] = c0;
        data[off + 1] = data[off + 5] = c1;
        data[off + 2] = data[off + 6] = c2;
    }

    private _drawHalfPixel(data: Uint8ClampedArray, off: number, color: Color) {
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

    private _start() { return (0x20 * this.page); }

    private _end() { return (0x020 * this.page) + 0x1f; }

    private _read(page: byte, off: byte, bank: bank) {
        const addr = (page << 8) | off, base = addr & 0x1FFF;
        return this._buffer[bank][base];
    }

    private _write(page: byte, off: byte, val: byte, bank: bank) {
        const addr = (page << 8) | off;
        const base = addr & 0x1FFF;

        if (this._buffer[bank][base] == val && !this._refreshing) {
            return;
        }
        this._buffer[bank][base] = val;

        const col = (base % 0x80) % 0x28;
        const adj = off - col;

        // 000001cd eabab000 -> 000abcde
        const ab = (adj & 0x18);
        const cd = (page & 0x03) << 1;
        const e = adj >> 7;

        const rowa = ab | cd | e,
            rowb = base >> 10;

        const data = this.imageData.data;
        if ((rowa < 24) && (col < 40) && this.vm.hiresMode) {
            let y = rowa << 3 | rowb;
            if (y < this.dirty.top) { this.dirty.top = y; }
            y += 1;
            if (y > this.dirty.bottom) { this.dirty.bottom = y; }
            let x = col * 14 - 2;
            if (x < this.dirty.left) { this.dirty.left = x; }
            x += 14;
            if (x > this.dirty.right) { this.dirty.right = x; }

            const dy = rowa << 3 | rowb;
            if (this.vm.doubleHiresMode) {
                const dx = col * 14 + (bank ? 0 : 7);
                let offset = dx * 4 + dy * 280 * 4 * 2;

                let bits = val;
                for (let jdx = 0; jdx < 7; jdx++, offset += 4) {
                    if (bits & 0x01) {
                        this._drawHalfPixel(data, offset, whiteCol);
                    } else {
                        this._drawHalfPixel(data, offset, blackCol);
                    }
                    bits >>= 1;
                }
            } else if (bank === 0) {
                const hbs = val & 0x80;
                const lastCol = col === 39;
                const cropLastPixel = hbs && lastCol;
                const dx = col * 14;
                let offset = dx * 4 + dy * 560 * 4;
                if (hbs) {
                    const val0 = this._buffer[bank][base - 1] || 0;
                    if (val0 & 0x40) {
                        this._drawHalfPixel(data, offset, whiteCol);
                    } else {
                        this._drawHalfPixel(data, offset, blackCol);
                    }
                    offset += 4;
                }
                let bits = val;
                for (let idx = 0; idx < 7; idx++, offset += 8) {
                    const drawPixel = cropLastPixel && idx == 6
                        ? this._drawHalfPixel
                        : this._drawPixel;
                    if (bits & 0x01) {
                        drawPixel(data, offset, whiteCol);
                    } else {
                        drawPixel(data, offset, blackCol);
                    }
                    bits >>= 1;
                }
                if (!this._refreshing) {
                    this._refreshing = true;
                    const after = addr + 1;
                    this._write(after >> 8, after & 0xff, this._buffer[0][after & 0x1fff], 0);
                    this._refreshing = false;
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
            if (this.vm._80colMode) {
                this._write(page, off, this._buffer[1][idx], 1);
            }
        }
        this._refreshing = false;
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
            buffer: [
                new Uint8Array(this._buffer[0]),
                new Uint8Array(this._buffer[1]),
            ]
        };
    }

    setState(state: GraphicsState) {
        this._buffer[0] = new Uint8Array(state.buffer[0]);
        this._buffer[1] = new Uint8Array(state.buffer[1]);

        this.refresh();
    }
}

export class VideoModesGL implements VideoModes {
    private _grs: LoresPage[] = [];
    private _hgrs: HiresPage[] = [];
    private _sv: screenEmu.ScreenView;
    private _displayConfig: screenEmu.DisplayConfiguration;
    private _scanlines: boolean = false;
    private _refreshFlag: boolean = true;
    private _canvas: HTMLCanvasElement;

    public ready: Promise<void>;

    public textMode: boolean;
    public mixedMode: boolean;
    public hiresMode: boolean;
    public pageMode: pageNo;
    public _80colMode: boolean;
    public altCharMode: boolean;
    public an3State: boolean;
    public doubleHiresMode: boolean;

    public flag = 0;
    public monoMode: boolean = false;

    public context: CanvasRenderingContext2D;

    constructor(
        private screen: HTMLCanvasElement,
        private e: boolean
    ) {
        this._canvas = document.createElement('canvas');
        const context = this._canvas.getContext('2d');
        if (!context) {
            throw new Error('no 2d context');
        }
        const { width, height } = screenEmu.C.NTSC_DETAILS.imageSize;
        this._canvas.width = width;
        this._canvas.height = height;
        this.context = context;
        this._sv = new screenEmu.ScreenView(this.screen);

        this.ready = this.init();
    }

    async init() {
        await this._sv.initOpenGL();

        this._displayConfig = this.defaultMonitor();
        this._sv.displayConfiguration = this._displayConfig;
    }

    private defaultMonitor(): screenEmu.DisplayConfiguration {
        const config = new screenEmu.DisplayConfiguration();
        config.displayResolution = new screenEmu.Size(this.screen.width, this.screen.height);
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
        const config = new screenEmu.DisplayConfiguration();
        config.displayResolution = new screenEmu.Size(this.screen.width, this.screen.height);
        config.videoDecoder = 'CANVAS_MONOCHROME';
        config.videoBrightness = 0.15;
        config.videoContrast = 0.8;
        config.videoSaturation = 1.45;
        config.videoHue = 0.27;
        config.videoCenter = new screenEmu.Point(0.01, 0.02);
        config.videoSize = new screenEmu.Size(1.25, 1.15);
        config.videoBandwidth = 9000000;
        config.displayBarrel = 0.1;
        config.displayScanlineLevel = 0.5;
        config.displayCenterLighting = 0.5;
        config.displayLuminanceGain = 1.5;
        return config;
    }

    private _refresh() {
        this.doubleHiresMode = !this.an3State && this.hiresMode && this._80colMode;

        this._refreshFlag = true;

        if (this._displayConfig) {
            this._displayConfig.videoWhiteOnly = this.textMode || this.monoMode;
            this._displayConfig.displayScanlineLevel = this._scanlines ? 0.5 : 0;
            this._sv.displayConfiguration = this._displayConfig;
        }
    }

    refresh() {
        this._refresh();
    }

    reset() {
        this.textMode = true;
        this.mixedMode = false;
        this.hiresMode = true;
        this.pageMode = 1;

        this._80colMode = false;
        this.altCharMode = false;

        this.an3State = true;

        this._refresh();
    }

    setLoresPage(page: pageNo, lores: LoresPage) {
        this._grs[page - 1] = lores;
    }

    setHiresPage(page: pageNo, hires: HiresPage) {
        this._hgrs[page - 1] = hires;
    }

    text(on: boolean) {
        const old = this.textMode;
        this.textMode = on;

        if (old != on) {
            this._refresh();
        }
    }

    _80col(on: boolean) {
        if (!this.e) { return; }

        const old = this._80colMode;
        this._80colMode = on;

        if (old != on) {
            this._refresh();
        }
    }

    altChar(on: boolean) {
        if (!this.e) { return; }

        const old = this.altCharMode;
        this.altCharMode = on;
        if (old != on) {
            this._refresh();
        }
    }

    hires(on: boolean) {
        const old = this.hiresMode;
        this.hiresMode = on;

        if (old != on) {
            this._refresh();
        }
    }

    an3(on: boolean) {
        if (!this.e) { return; }

        const old = this.an3State;
        this.an3State = on;

        if (old != on) {
            this._refresh();
        }
    }

    doubleHires(on: boolean) {
        this.an3(!on);
    }

    mixed(on: boolean) {
        const old = this.mixedMode;
        this.mixedMode = on;
        if (old != on) {
            this._refresh();
        }
    }

    page(pageNo: pageNo) {
        const old = this.pageMode;
        this.pageMode = pageNo;
        if (old != pageNo) {
            this._refresh();
        }
    }

    isText() {
        return this.textMode;
    }

    isMixed() {
        return this.mixedMode;
    }

    isPage2() {
        return this.pageMode == 2;
    }

    isHires() {
        return this.hiresMode;
    }

    isDoubleHires() {
        return this.doubleHiresMode;
    }

    is80Col() {
        return this._80colMode;
    }

    isAltChar() {
        return this.altCharMode;
    }

    updateImage(
        mainData: ImageData,
        mainDirty: Region,
        mixData?: ImageData | null,
        mixDirty?: Region | null
    ) {
        let blitted = false;
        if (mainDirty.bottom !== -1 || (mixDirty && mixDirty.bottom !== -1)) {
            const imageData = this.buildScreen(mainData, mixData);
            const imageInfo = new screenEmu.ImageInfo(imageData);
            this._sv.image = imageInfo;
            blitted = true;
        }
        this._sv.vsync();
        return blitted;
    }

    buildScreen(mainData: ImageData, mixData?: ImageData | null) {
        const details = screenEmu.C.NTSC_DETAILS;
        const { width, height } = details.imageSize;
        const { x, y } = this._80colMode ? details.topLeft80Col : details.topLeft;

        if (mixData) {
            this.context.putImageData(mainData, x, y, 0, 0, 560, 160);
            this.context.putImageData(mixData, x, y, 0, 160, 560, 32);
        } else {
            this.context.putImageData(mainData, x, y);
        }
        return this.context.getImageData(0, 0, width, height);
    }

    blit(altData?: ImageData) {
        let blitted = false;
        const hgr = this._hgrs[this.pageMode - 1];
        const gr = this._grs[this.pageMode - 1];

        if (this._refreshFlag) {
            hgr.refresh();
            gr.refresh();
            this._refreshFlag = false;
        }

        if (altData) {
            blitted = this.updateImage(
                altData,
                { top: 0, left: 0, right: 560, bottom: 192 }
            );
        } else if (this.hiresMode && !this.textMode) {
            blitted = this.updateImage(
                hgr.imageData,
                hgr.dirty,
                this.mixedMode ? gr.imageData : null,
                this.mixedMode ? gr.dirty : null
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
            textMode: this.textMode,
            mixedMode: this.mixedMode,
            hiresMode: this.hiresMode,
            pageMode: this.pageMode,
            _80colMode: this._80colMode,
            altCharMode: this.altCharMode,
            an3State: this.an3State,
            flag: 0
        };
    }

    setState(state: VideoModesState) {
        this.textMode = state.textMode;
        this.mixedMode = state.mixedMode;
        this.hiresMode = state.hiresMode;
        this.pageMode = state.pageMode;
        this._80colMode = state._80colMode;
        this.altCharMode = state.altCharMode;
        this.an3State = state.an3State;

        this._grs[0].setState(state.grs[0]);
        this._grs[1].setState(state.grs[1]);
        this._hgrs[0].setState(state.hgrs[0]);
        this._hgrs[1].setState(state.hgrs[1]);
        this._refresh();
    }

    mono(on: boolean) {
        this.monoMode = on;
        this._displayConfig = on ? this.monitorII() : this.defaultMonitor();
        this._refresh();
    }

    scanlines(on: boolean) {
        this._scanlines = on;
        this._refresh();
    }

    getText() {
        return this._grs[this.pageMode - 1].getText();
    }
}
