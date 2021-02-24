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

import CPU6502, { PageHandler } from './cpu6502';
import { Card, Memory, TapeData, byte, Restorable } from './types';
import { debug } from './util';

type slot = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type button = 0 | 1 | 2;
type paddle = 0 | 1 | 2 | 3;
type annunciator = 0 | 1 | 2 | 3;

interface Annunciators {
    0: boolean,
    1: boolean,
    2: boolean,
    3: boolean,
}

export interface Apple2IOState {
    annunciators: Annunciators;
}

export type SampleListener = (sample: number[]) => void;

const LOC = {
    KEYBOARD: 0x00, // keyboard data (latched) (Read),
    STROBE: 0x10, // clear bit 7 of keyboard data ($C000)
    TAPEOUT: 0x20, // toggle the cassette output.
    SPEAKER: 0x30, // toggle speaker diaphragm
    C040STB: 0x40, // trigger game port sync
    CLRTEXT: 0x50, // display graphics
    SETTEXT: 0x51, // display text
    CLRMIXED: 0x52, // clear mixed mode- enable full graphics
    SETMIXED: 0x53, // enable graphics/text mixed mode
    PAGE1: 0x54, // select text/graphics page1
    PAGE2: 0x55, // select text/graphics page2
    CLRHIRES: 0x56, // select Lo-res
    SETHIRES: 0x57, // select Hi-res
    CLRAN0: 0x58, // Set annunciator-0 output to 0
    SETAN0: 0x59, // Set annunciator-0 output to 1
    CLRAN1: 0x5A, // Set annunciator-1 output to 0
    SETAN1: 0x5B, // Set annunciator-1 output to 1
    CLRAN2: 0x5C, // Set annunciator-2 output to 0
    SETAN2: 0x5D, // Set annunciator-2 output to 1
    CLRAN3: 0x5E, // Set annunciator-3 output to 0
    SETAN3: 0x5F, // Set annunciator-3 output to 1
    TAPEIN: 0x60, // bit 7: data from cassette
    PB0: 0x61, // game Pushbutton 0 / open apple (command) key data
    PB1: 0x62, // game Pushbutton 1 / closed apple (option) key data
    PB2: 0x63, // game Pushbutton 2 (read)
    PADDLE0: 0x64, // bit 7: status of pdl-0 timer (read)
    PADDLE1: 0x65, // bit 7: status of pdl-1 timer (read)
    PADDLE2: 0x66, // bit 7: status of pdl-2 timer (read)
    PADDLE3: 0x67, // bit 7: status of pdl-3 timer (read)
    PDLTRIG: 0x70, // trigger paddles
    ACCEL: 0x74, // CPU Speed control
};

export default class Apple2IO implements PageHandler, Restorable<Apple2IOState> {
    private _slot: Card[] = [];
    private _auxRom: Memory | null = null;

    private _khz = 1023;
    private _rate = 44000;
    private _sample_size = 4096;

    private _cycles_per_sample: number;

    private _buffer: string[] = [];
    private _key = 0;
    private _keyDown = false;
    private _button = [false, false, false];
    private _paddle = [0.0, 0.0, 0.0, 0, 0];
    private _phase = -1;
    private _sample: number[] = [];
    private _sampleIdx = 0;
    private _sampleTime = 0;
    private _didAudio = false;

    private _high = 0.5;
    private _low = -0.5;

    private _audioListener: SampleListener | undefined;

    private _trigger = 0;
    private _annunciators: Annunciators = [false, false, false, false];

    private _tape: TapeData = [];
    private _tapeOffset = 0;
    private _tapeNext: number = 0;
    private _tapeCurrent = false;

    constructor(private readonly cpu: CPU6502, private readonly vm: any) {
        this.init();
    }

    init() {
        this._calcSampleRate();
    }

    _debug(..._args: any[]) {
        // debug.apply(this, arguments);
    }

    _tick() {
        const now = this.cpu.getCycles();
        const phase = this._didAudio ? (this._phase > 0 ? this._high : this._low) : 0.0;
        for (; this._sampleTime < now; this._sampleTime += this._cycles_per_sample) {
            this._sample[this._sampleIdx++] = phase;
            if (this._sampleIdx === this._sample_size) {
                if (this._audioListener) {
                    this._audioListener(this._sample);
                }
                this._sample = new Array(this._sample_size);
                this._sampleIdx = 0;
            }
        }
        this._didAudio = false;
    }

    _calcSampleRate() {
        this._cycles_per_sample = this._khz * 1000 / this._rate;
    }

    _updateKHz(khz: number) {
        this._khz = khz;
        this._calcSampleRate();
    }

    _access(off: byte, val?: byte): byte | undefined {
        let result: number | undefined = 0;
        const now = this.cpu.getCycles();
        const writeMode = val === undefined;
        const delta = now - this._trigger;
        switch (off) {
            case LOC.CLRTEXT:
                this._debug('Graphics Mode');
                this.vm.text(false);
                break;
            case LOC.SETTEXT:
                this._debug('Text Mode');
                this.vm.text(true);
                break;
            case LOC.CLRMIXED:
                this._debug('Mixed Mode off');
                this.vm.mixed(false);
                break;
            case LOC.SETMIXED:
                this._debug('Mixed Mode on');
                this.vm.mixed(true);
                break;
            case LOC.CLRHIRES:
                this._debug('LoRes Mode');
                this.vm.hires(false);
                break;
            case LOC.SETHIRES:
                this._debug('HiRes Mode');
                this.vm.hires(true);
                break;
            case LOC.PAGE1:
                this.vm.page(1);
                break;
            case LOC.PAGE2:
                this.vm.page(2);
                break;
            case LOC.SETAN0:
                this._debug('Annunciator 0 on');
                this._annunciators[0] = true;
                break;
            case LOC.SETAN1:
                this._debug('Annunciator 1 on');
                this._annunciators[1] = true;
                break;
            case LOC.SETAN2:
                this._debug('Annunciator 2 on');
                this._annunciators[2] = true;
                break;
            case LOC.SETAN3:
                this._debug('Annunciator 3 on');
                this._annunciators[3] = true;
                break;
            case LOC.CLRAN0:
                this._debug('Annunciator 0 off');
                this._annunciators[0] = false;
                break;
            case LOC.CLRAN1:
                this._debug('Annunciator 1 off');
                this._annunciators[1] = false;
                break;
            case LOC.CLRAN2:
                this._debug('Annunciator 2 off');
                this._annunciators[2] = false;
                break;
            case LOC.CLRAN3:
                this._debug('Annunciator 3 off');
                this._annunciators[3] = false;
                break;
            case LOC.PB0:
                result = this._button[0] ? 0x80 : 0;
                break;
            case LOC.PB1:
                result = this._button[1] ? 0x80 : 0;
                break;
            case LOC.PB2:
                result = this._button[2] ? 0x80 : 0;
                break;
            case LOC.PADDLE0:
                result = (delta < (this._paddle[0] * 2756) ? 0x80 : 0x00);
                break;
            case LOC.PADDLE1:
                result = (delta < (this._paddle[1] * 2756) ? 0x80 : 0x00);
                break;
            case LOC.PADDLE2:
                result = (delta < (this._paddle[2] * 2756) ? 0x80 : 0x00);
                break;
            case LOC.PADDLE3:
                result = (delta < (this._paddle[3] * 2756) ? 0x80 : 0x00);
                break;
            case LOC.ACCEL:
                if (val !== undefined) {
                    this._updateKHz(val & 0x01 ? 1023 : 4096);
                }
                break;
            case LOC.TAPEIN:
                if (this._tapeOffset == -1) {
                    this._tapeOffset = 0;
                    this._tapeNext = now;
                }

                if (this._tapeOffset < this._tape.length) {
                    this._tapeCurrent = this._tape[this._tapeOffset][1];
                    while (now >= this._tapeNext) {
                        if ((this._tapeOffset % 1000) === 0) {
                            debug('Read ' + (this._tapeOffset / 1000));
                        }
                        this._tapeCurrent = this._tape[this._tapeOffset][1];
                        this._tapeNext += this._tape[this._tapeOffset++][0];
                    }

                }

                result = this._tapeCurrent ? 0x80 : 0x00;
                break;

            default:
                switch (off & 0xf0) {
                    case LOC.KEYBOARD: // C00x
                        result = this._key;
                        break;
                    case LOC.STROBE: // C01x
                        if (off === LOC.STROBE || writeMode) {
                            this._key &= 0x7f;
                        }
                        if (this._buffer.length > 0) {
                            let val = this._buffer.shift() as string;
                            if (val == '\n') {
                                val = '\r';
                            }
                            this._key = val.charCodeAt(0) | 0x80;
                        }
                        result = this._key & 0x7f;
                        if (off === LOC.STROBE) {
                            result |= this._keyDown ? 0x80 : 0x00;
                        }
                        break;
                    case LOC.TAPEOUT: // C02x
                        this._phase = -this._phase;
                        this._didAudio = true;
                        this._tick();
                        break;
                    case LOC.SPEAKER: // C03x
                        this._phase = -this._phase;
                        this._didAudio = true;
                        this._tick();
                        break;
                    case LOC.C040STB: // C04x
                        // I/O Strobe
                        break;
                    case LOC.PDLTRIG: // C07x
                        this._trigger = this.cpu.getCycles();
                        break;
                }
        }

        if (val !== undefined) {
            result = undefined;
        }

        return result;
    }

    start() {
        return 0xc0;
    }

    end() {
        return 0xcf;
    }

    ioSwitch(off: byte, val?: byte) {
        let result;
        if (off < 0x80) {
            result = this._access(off, val);
        } else {
            const slot = (off & 0x70) >> 4;
            const card = this._slot[slot];
            if (card && card.ioSwitch) {
                result = card.ioSwitch(off, val);
            }
        }

        return result;
    }

    reset() {
        for (let slot = 0; slot < 8; slot++) {
            const card = this._slot[slot];
            if (card) {
                card.reset?.();
            }
        }
        this.vm.reset();
    }

    blit() {
        const card = this._slot[3];
        if (card) {
            return card.blit?.();
        }
        return undefined;
    }

    read(page: byte, off: byte) {
        let result: number = 0;
        let slot;
        let card;

        switch (page) {
            case 0xc0:
                result = this.ioSwitch(off, undefined) || 0;
                break;
            case 0xc1:
            case 0xc2:
            case 0xc3:
            case 0xc4:
            case 0xc5:
            case 0xc6:
            case 0xc7:
                slot = page & 0x0f;
                card = this._slot[slot];
                if (this._auxRom != card) {
                // _debug('Setting auxRom to slot', slot);
                    this._auxRom = card;
                }
                if (card) {
                    result = card.read(page, off);
                }
                break;
            default:
                if (this._auxRom) {
                    result = this._auxRom.read(page, off);
                }
                break;
        }
        return result;
    }

    write(page: byte, off: byte, val: byte) {
        let slot;
        let card;

        switch (page) {
            case 0xc0:
                this.ioSwitch(off, val);
                break;
            case 0xc1:
            case 0xc2:
            case 0xc3:
            case 0xc4:
            case 0xc5:
            case 0xc6:
            case 0xc7:
                slot = page & 0x0f;
                card = this._slot[slot];
                if (this._auxRom != card) {
                // _debug('Setting auxRom to slot', slot);
                    this._auxRom = card;
                }
                if (card) {
                    card.write(page, off, val);
                }
                break;
            default:
                if (this._auxRom) {
                    this._auxRom.write(page, off, val);
                }
                break;
        }
    }

    getState(): Apple2IOState {
        return {
            annunciators: this._annunciators
        };
    }

    setState(state: Apple2IOState) {
        this._annunciators = state.annunciators;
    }

    setSlot(slot: slot, card: Card) {
        this._slot[slot] = card;
    }

    keyDown(ascii: byte) {
        this._keyDown = true;
        this._key = ascii | 0x80;
    }

    keyUp() {
        this._keyDown = false;
    }

    buttonDown(b: button) {
        this._button[b] = true;
    }

    buttonUp(b: button) {
        this._button[b] = false;
    }

    paddle(p: paddle, v: byte) {
        this._paddle[p] = v;
    }

    updateKHz(khz: number) {
        this._updateKHz(khz);
    }

    getKHz() {
        return this._khz;
    }

    setKeyBuffer(buffer: string) {
        this._buffer = buffer.split(''); // split to charaters
        if (this._buffer.length > 0) {
            this._keyDown = true;
            const key = this._buffer.shift() as string; // never undefined
            this._key = key.charCodeAt(0) | 0x80;
        }
    }

    setTape(tape: TapeData) { // TODO(flan): Needs typing.
        debug('Tape length: ' + tape.length);
        this._tape = tape;
        this._tapeOffset = -1;
    }

    sampleRate(rate: number, sample_size: number) {
        this._rate = rate;
        this._sample_size = sample_size;
        this._sample = new Array(this._sample_size);
        this._sampleIdx = 0;
        this._calcSampleRate();
    }

    tick() {
        this._tick();
        for (let idx = 0; idx < 8; idx++) {
            if (this._slot[idx]) {
                this._slot[idx].tick?.();
            }
        }
    }

    addSampleListener(cb: SampleListener) {
        this._audioListener = cb;
    }

    annunciator(idx: annunciator) {
        return this._annunciators[idx];
    }

    cycles() {
        return this.cpu.getCycles();
    }
}
