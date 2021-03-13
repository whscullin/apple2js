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

import { MemoryPages } from './types';
import CPU6502 from './cpu6502';
import RAM, { RAMState } from './ram';
import ROM, { ROMState } from './roms/rom';
import { debug } from './util';
import { byte, Memory, Restorable } from './types';
import Apple2IO from './apple2io';
import { HiresPage, LoresPage, VideoModes } from './videomodes';

/*
 * I/O Switch locations
 */
const LOC = {
    // 80 Column memory
    _80STOREOFF: 0x00,
    _80STOREON: 0x01,

    // Aux RAM
    RAMRDOFF: 0x02,
    RAMRDON: 0x03,

    RAMWROFF: 0x04,
    RAMWRON: 0x05,

    // Bank switched ROM
    INTCXROMOFF: 0x06,
    INTCXROMON: 0x07,
    ALTZPOFF: 0x08,
    ALTZPON: 0x09,
    SLOTC3ROMOFF: 0x0A,
    SLOTC3ROMON: 0x0B,

    // 80 Column video
    CLR80VID: 0x0C, // clear 80 column mode
    SET80VID: 0x0D, // set 80 column mode
    CLRALTCH: 0x0E, // clear mousetext
    SETALTCH: 0x0F, // set mousetext

    // Status
    BSRBANK2: 0x11,
    BSRREADRAM: 0x12,
    RAMRD: 0x13,
    RAMWRT: 0x14,
    INTCXROM: 0x15,
    ALTZP: 0x16,
    SLOTC3ROM: 0x17,
    _80STORE: 0x18,
    VERTBLANK: 0x19,

    RDTEXT: 0x1A, // using text mode
    RDMIXED: 0x1B, // using mixed mode
    RDPAGE2: 0x1C, // using text/graphics page2
    RDHIRES: 0x1D, // using Hi-res graphics mode
    RDALTCH: 0x1E, // using alternate character set
    RD80VID: 0x1F, // using 80-column display mode

    // Graphics
    PAGE1: 0x54, // select text/graphics page1 main/aux
    PAGE2: 0x55, // select text/graphics page2 main/aux
    RESET_HIRES: 0x56,
    SET_HIRES: 0x57,

    DHIRESON: 0x5E, // Enable double hires (CLRAN3)
    DHIRESOFF: 0x5F, // Disable double hires (SETAN3)

    // Misc
    BANK: 0x73, // Back switched RAM card bank

    IOUDISON: 0x7E, // W IOU Disable on / R7 IOU Disable
    IOUDISOFF: 0x7F, // W IOU Disable off / R7 Double Hires

    // Language Card

    // Bank 2
    READBSR2: 0x80,
    WRITEBSR2: 0x81,
    OFFBSR2: 0x82,
    READWRBSR2: 0x83,

    // Bank 1
    READBSR1: 0x88,
    WRITEBSR1: 0x89,
    OFFBSR1: 0x8a,
    READWRBSR1: 0x8b,
};

class Switches implements MemoryPages {
    constructor(private mmu: MMU) {}

    start() {
        return 0xC0;
    }

    end() {
        return 0xC0;
    }

    read(_page: byte, off: byte) {
        return this.mmu._access(off) || 0;
    }

    write(_page: byte, off: byte, val: byte) {
        this.mmu._access(off, val);
    }
}

class AuxRom implements MemoryPages {
    constructor(
        private readonly mmu: MMU,
        private readonly rom: ROM) { }

    start() {
        return 0xc1;
    }

    end() {
        return 0xcf;
    }

    read(page: byte, off: byte) {
        if (page == 0xc3) {
            this.mmu._setIntc8rom(true);
            this.mmu._updateBanks();
        }
        if (page == 0xcf && off == 0xff) {
            this.mmu._setIntc8rom(false);
            this.mmu._updateBanks();
        }
        return this.rom.read(page, off);
    }

    write(_page: byte, _off: byte, _val: byte) {
        // It's ROM.
    }
}

export interface MMUState {
    bank1: boolean
    readbsr: boolean
    writebsr: boolean
    prewrite: boolean

    intcxrom: boolean
    slot3rom: boolean
    intc8rom: boolean

    auxRamRead: boolean
    auxRamWrite: boolean
    altzp: boolean

    _80store: boolean
    page2: boolean
    hires: boolean

    mem00_01: [RAMState, RAMState]
    mem02_03: [RAMState, RAMState]
    mem0C_1F: [RAMState, RAMState]
    mem60_BF: [RAMState, RAMState]
    memD0_DF: [ROMState, RAMState, RAMState, RAMState, RAMState]
    memE0_FF: [ROMState, RAMState, RAMState]
}

export default class MMU implements Memory, Restorable<MMUState> {
    private _readPages = new Array<Memory>(0x100);
    private _writePages = new Array<Memory>(0x100);
    private _pages = new Array<Memory[]>(0x100);

    // Language Card RAM Softswitches
    private _bank1: boolean;
    private _readbsr: boolean;
    private _writebsr: boolean;
    private _prewrite: boolean;

    // Auxillary ROM
    private _intcxrom: boolean;
    private _slot3rom: boolean;
    private _intc8rom: boolean;

    // Auxillary RAM
    private _auxRamRead: boolean;
    private _auxRamWrite: boolean;
    private _altzp: boolean;

    // Video
    private _80store: boolean;
    private _page2: boolean;
    private _hires: boolean;

    private _iouDisable: boolean;

    private _vbEnd = 0;

    private switches = new Switches(this);
    private auxRom = new AuxRom(this, this.rom);

    // These fields represent the bank-switched memory ranges.
    private mem00_01 = [new RAM(0x0, 0x1), new RAM(0x0, 0x1)];
    private mem02_03 = [new RAM(0x2, 0x3), new RAM(0x2, 0x3)];
    private mem04_07 = [this.lores1.bank0(), this.lores1.bank1()];
    private mem08_0B = [this.lores2.bank0(), this.lores2.bank1()];
    private mem0C_1F = [new RAM(0xC, 0x1F), new RAM(0xC, 0x1F)];
    private mem20_3F = [this.hires1.bank0(), this.hires1.bank1()];
    private mem40_5F = [this.hires2.bank0(), this.hires2.bank1()];
    private mem60_BF = [new RAM(0x60, 0xBF), new RAM(0x60, 0xBF)];
    private memC0_C0 = [this.switches];
    private memC1_CF = [this.io, this.auxRom];
    private memD0_DF: [ROM, RAM, RAM, RAM, RAM] = [
        this.rom,
        new RAM(0xD0, 0xDF), new RAM(0xD0, 0xDF),
        new RAM(0xD0, 0xDF), new RAM(0xD0, 0xDF)
    ];
    private memE0_FF: [ROM, RAM, RAM] = [
        this.rom,
        new RAM(0xE0, 0xFF), new RAM(0xE0, 0xFF)
    ];

    constructor(
        private readonly cpu: CPU6502,
        private readonly vm: VideoModes,
        private readonly lores1: LoresPage,
        private readonly lores2: LoresPage,
        private readonly hires1: HiresPage,
        private readonly hires2: HiresPage,
        private readonly io: Apple2IO,
        private readonly rom: ROM) {
        /*
         * Initialize read/write banks
         */

        // Zero Page/Stack
        for (let idx = 0x0; idx < 0x2; idx++) {
            this._pages[idx] = this.mem00_01;
            this._readPages[idx] = this._pages[idx][0];
            this._writePages[idx] = this._pages[idx][0];
        }
        // 0x300-0x400
        for (let idx = 0x2; idx < 0x4; idx++) {
            this._pages[idx] = this.mem02_03;
            this._readPages[idx] = this._pages[idx][0];
            this._writePages[idx] = this._pages[idx][0];
        }
        // Text Page 1
        for (let idx = 0x4; idx < 0x8; idx++) {
            this._pages[idx] = this.mem04_07;
            this._readPages[idx] = this._pages[idx][0];
            this._writePages[idx] = this._pages[idx][0];
        }
        // Text Page 2
        for (let idx = 0x8; idx < 0xC; idx++) {
            this._pages[idx] = this.mem08_0B;
            this._readPages[idx] = this._pages[idx][0];
            this._writePages[idx] = this._pages[idx][0];
        }
        // 0xC00-0x2000
        for (let idx = 0xC; idx < 0x20; idx++) {
            this._pages[idx] = this.mem0C_1F;
            this._readPages[idx] = this._pages[idx][0];
            this._writePages[idx] = this._pages[idx][0];
        }
        // Hires Page 1
        for (let idx = 0x20; idx < 0x40; idx++) {
            this._pages[idx] = this.mem20_3F;
            this._readPages[idx] = this._pages[idx][0];
            this._writePages[idx] = this._pages[idx][0];
        }
        // Hires Page 2
        for (let idx = 0x40; idx < 0x60; idx++) {
            this._pages[idx] = this.mem40_5F;
            this._readPages[idx] = this._pages[idx][0];
            this._writePages[idx] = this._pages[idx][0];
        }
        // 0x6000-0xc000
        for (let idx = 0x60; idx < 0xc0; idx++) {
            this._pages[idx] = this.mem60_BF;
            this._readPages[idx] = this._pages[idx][0];
            this._writePages[idx] = this._pages[idx][0];
        }
        // I/O Switches
        {
            const idx = 0xc0;
            this._pages[idx] = this.memC0_C0;
            this._readPages[idx] = this._pages[idx][0];
            this._writePages[idx] = this._pages[idx][0];
        }
        // Slots
        for (let idx = 0xc1; idx < 0xd0; idx++) {
            this._pages[idx] = this.memC1_CF;
            this._readPages[idx] = this._pages[idx][0];
            this._writePages[idx] = this._pages[idx][0];
        }
        // Basic ROM
        for (let idx = 0xd0; idx < 0xe0; idx++) {
            this._pages[idx] = this.memD0_DF;
            this._readPages[idx] = this._pages[idx][0];
            this._writePages[idx] = this._pages[idx][0];
        }
        // Monitor ROM
        for (let idx = 0xe0; idx < 0x100; idx++) {
            this._pages[idx] = this.memE0_FF;
            this._readPages[idx] = this._pages[idx][0];
            this._writePages[idx] = this._pages[idx][0];
        }
    }

    _initSwitches() {
        this._bank1 = false;
        this._readbsr = false;
        this._writebsr = false;
        this._prewrite = false;

        this._auxRamRead = false;
        this._auxRamWrite = false;
        this._altzp = false;

        this._intcxrom = false;
        this._slot3rom = false;
        this._intc8rom = false;

        this._80store = false;
        this._page2 = false;
        this._hires = false;

        this._iouDisable = true;
    }

    _debug(..._args: any[]) {
        // debug.apply(this, _args);
    }

    _setIntc8rom(on: boolean) {
        this._intc8rom = on;
    }

    _updateBanks() {
        if (this._auxRamRead) {
            for (let idx = 0x02; idx < 0xC0; idx++) {
                this._readPages[idx] = this._pages[idx][1];
            }
        } else {
            for (let idx = 0x02; idx < 0xC0; idx++) {
                this._readPages[idx] = this._pages[idx][0];
            }
        }

        if (this._auxRamWrite) {
            for (let idx = 0x02; idx < 0xC0; idx++) {
                this._writePages[idx] = this._pages[idx][1];
            }
        } else {
            for (let idx = 0x02; idx < 0xC0; idx++) {
                this._writePages[idx] = this._pages[idx][0];
            }
        }

        if (this._80store) {
            if (this._page2) {
                for (let idx = 0x4; idx < 0x8; idx++) {
                    this._readPages[idx] = this._pages[idx][1];
                    this._writePages[idx] = this._pages[idx][1];
                }
                if (this._hires) {
                    for (let idx = 0x20; idx < 0x40; idx++) {
                        this._readPages[idx] = this._pages[idx][1];
                        this._writePages[idx] = this._pages[idx][1];
                    }
                }
            } else {
                for (let idx = 0x4; idx < 0x8; idx++) {
                    this._readPages[idx] = this._pages[idx][0];
                    this._writePages[idx] = this._pages[idx][0];
                }
                if (this._hires) {
                    for (let idx = 0x20; idx < 0x40; idx++) {
                        this._readPages[idx] = this._pages[idx][0];
                        this._writePages[idx] = this._pages[idx][0];
                    }
                }
            }
        }

        if (this._intcxrom) {
            for (let idx = 0xc1; idx < 0xd0; idx++) {
                this._readPages[idx] = this._pages[idx][1];
                this._writePages[idx] = this._pages[idx][1];
            }
        } else {
            for (let idx = 0xc1; idx < 0xd0; idx++) {
                this._readPages[idx] = this._pages[idx][0];
                this._writePages[idx] = this._pages[idx][0];
            }
            if (!this._slot3rom) {
                this._readPages[0xc3] = this._pages[0xc3][1];
                this._writePages[0xc3] = this._pages[0xc3][1];
            }
            if (this._intc8rom) {
                for (let idx = 0xc8; idx < 0xd0; idx++) {
                    this._readPages[idx] = this._pages[idx][1];
                    this._writePages[idx] = this._pages[idx][1];
                }
            }
        }

        if (this._altzp) {
            for (let idx = 0x0; idx < 0x2; idx++) {
                this._readPages[idx] = this._pages[idx][1];
                this._writePages[idx] = this._pages[idx][1];
            }
        } else {
            for (let idx = 0x0; idx < 0x2; idx++) {
                this._readPages[idx] = this._pages[idx][0];
                this._writePages[idx] = this._pages[idx][0];
            }
        }

        if (this._readbsr) {
            if (this._bank1) {
                for (let idx = 0xd0; idx < 0xe0; idx++) {
                    this._readPages[idx] = this._pages[idx][this._altzp ? 2 : 1];
                }
            } else {
                for (let idx = 0xd0; idx < 0xe0; idx++) {
                    this._readPages[idx] = this._pages[idx][this._altzp ? 4 : 3];
                }
            }
            for (let idx = 0xe0; idx < 0x100; idx++) {
                this._readPages[idx] = this._pages[idx][this._altzp ? 2 : 1];
            }
        } else {
            for (let idx = 0xd0; idx < 0x100; idx++) {
                this._readPages[idx] = this._pages[idx][0];
            }
        }

        if (this._writebsr) {
            if (this._bank1) {
                for (let idx = 0xd0; idx < 0xe0; idx++) {
                    this._writePages[idx] = this._pages[idx][this._altzp ? 2 : 1];
                }
            } else {
                for (let idx = 0xd0; idx < 0xe0; idx++) {
                    this._writePages[idx] = this._pages[idx][this._altzp ? 4 : 3];
                }
            }
            for (let idx = 0xe0; idx < 0x100; idx++) {
                this._writePages[idx] = this._pages[idx][this._altzp ? 2 : 1];
            }
        } else {
            for (let idx = 0xd0; idx < 0x100; idx++) {
                this._writePages[idx] = this._pages[idx][0];
            }
        }
    }

    // Apple //e memory management

    _accessMMUSet(off: byte, _val?: byte) {
        switch (off) {
            case LOC._80STOREOFF:
                this._80store = false;
                this._debug('80 Store Off', _val);
                this.vm.page(this._page2 ? 2 : 1);
                break;
            case LOC._80STOREON:
                this._80store = true;
                this._debug('80 Store On', _val);
                break;
            case LOC.RAMRDOFF:
                this._auxRamRead = false;
                this._debug('Aux RAM Read Off');
                break;
            case LOC.RAMRDON:
                this._auxRamRead = true;
                this._debug('Aux RAM Read On');
                break;
            case LOC.RAMWROFF:
                this._auxRamWrite = false;
                this._debug('Aux RAM Write Off');
                break;
            case LOC.RAMWRON:
                this._auxRamWrite = true;
                this._debug('Aux RAM Write On');
                break;

            case LOC.INTCXROMOFF:
                this._intcxrom = false;
                this._intc8rom = false;
                this._debug('Int CX ROM Off');
                break;
            case LOC.INTCXROMON:
                this._intcxrom = true;
                this._debug('Int CX ROM On');
                break;
            case LOC.ALTZPOFF: // 0x08
                this._altzp = false;
                this._debug('Alt ZP Off');
                break;
            case LOC.ALTZPON: // 0x09
                this._altzp = true;
                this._debug('Alt ZP On');
                break;
            case LOC.SLOTC3ROMOFF: // 0x0A
                this._slot3rom = false;
                this._debug('Slot 3 ROM Off');
                break;
            case LOC.SLOTC3ROMON: // 0x0B
                this._slot3rom = true;
                this._debug('Slot 3 ROM On');
                break;

                // Graphics Switches

            case LOC.CLR80VID:
                this._debug('80 Column Mode off');
                this.vm._80col(false);
                break;
            case LOC.SET80VID:
                this._debug('80 Column Mode on');
                this.vm._80col(true);
                break;
            case LOC.CLRALTCH:
                this._debug('Alt Char off');
                this.vm.altchar(false);
                break;
            case LOC.SETALTCH:
                this._debug('Alt Char on');
                this.vm.altchar(true);
                break;
        }
        this._updateBanks();
    }

    // Status registers

    _accessStatus(off: byte, val?: byte) {
        let result = undefined;

        switch(off) {
            case LOC.BSRBANK2:
                this._debug('Bank 2 Read ' + !this._bank1);
                result = !this._bank1 ? 0x80 : 0x00;
                break;
            case LOC.BSRREADRAM:
                this._debug('Bank SW RAM Read ' + this._readbsr);
                result = this._readbsr ? 0x80 : 0x00;
                break;
            case LOC.RAMRD: // 0xC013
                this._debug('Aux RAM Read ' + this._auxRamRead);
                result = this._auxRamRead ? 0x80 : 0x0;
                break;
            case LOC.RAMWRT: // 0xC014
                this._debug('Aux RAM Write ' + this._auxRamWrite);
                result = this._auxRamWrite ? 0x80 : 0x0;
                break;
            case LOC.INTCXROM: // 0xC015
            // _debug('Int CX ROM ' + _intcxrom);
                result = this._intcxrom ? 0x80 : 0x00;
                break;
            case LOC.ALTZP: // 0xC016
                this._debug('Alt ZP ' + this._altzp);
                result = this._altzp ? 0x80 : 0x0;
                break;
            case LOC.SLOTC3ROM: // 0xC017
                this._debug('Slot C3 ROM ' + this._slot3rom);
                result = this._slot3rom ? 0x80 : 0x00;
                break;
            case LOC._80STORE: // 0xC018
                this._debug('80 Store ' + this._80store);
                result = this._80store ? 0x80 : 0x00;
                break;
            case LOC.VERTBLANK: // 0xC019
            // result = cpu.getCycles() % 20 < 5 ? 0x80 : 0x00;
                result = (this.cpu.getCycles() < this._vbEnd) ? 0x80 : 0x00;
                break;
            case LOC.RDTEXT:
                result = this.vm.isText() ? 0x80 : 0x0;
                break;
            case LOC.RDMIXED:
                result = this.vm.isMixed() ? 0x80 : 0x0;
                break;
            case LOC.RDPAGE2:
                result = this._page2 ? 0x80 : 0x0;
                break;
            case LOC.RDHIRES:
                result = this.vm.isHires() ? 0x80 : 0x0;
                break;
            case LOC.RD80VID:
                result = this.vm.is80Col() ? 0x80 : 0x0;
                break;
            case LOC.RDALTCH:
                result = this.vm.isAltChar() ? 0x80 : 0x0;
                break;
            default:
                result = this.io.ioSwitch(off, val);
        }

        return result;
    }

    _accessIOUDisable(off: byte, val?: byte) {
        const writeMode = val !== undefined;
        let result;

        switch (off) {
            case LOC.IOUDISON:
                if (writeMode) {
                    this._iouDisable = true;
                } else {
                    result = this._iouDisable ? 0x00 : 0x80;
                }
                break;

            case LOC.IOUDISOFF:
                if (writeMode) {
                    this._iouDisable = false;
                } else {
                    result = this.vm.isDoubleHires() ? 0x80 : 0x00;
                }
                break;

            default:
                result = this.io.ioSwitch(off, val);
        }

        return result;
    }


    _accessGraphics(off: byte, val?: byte) {
        let result: byte | undefined = 0;

        switch (off) {
            case LOC.PAGE1:
                this._page2 = false;
                if (!this._80store) {
                    result = this.io.ioSwitch(off, val);
                }
                this._debug('Page 2 off');
                break;

            case LOC.PAGE2:
                this._page2 = true;
                if (!this._80store) {
                    result = this.io.ioSwitch(off, val);
                }
                this._debug('Page 2 on');
                break;

            case LOC.RESET_HIRES:
                this._hires = false;
                result = this.io.ioSwitch(off, val);
                this._debug('Hires off');
                break;

            case LOC.DHIRESON:
                if (this._iouDisable) {
                    this.vm.doubleHires(true);
                } else {
                    result = this.io.ioSwitch(off, val); // an3
                }
                break;

            case LOC.DHIRESOFF:
                if (this._iouDisable) {
                    this.vm.doubleHires(false);
                } else {
                    result = this.io.ioSwitch(off, val); // an3
                }
                break;

            case LOC.SET_HIRES:
                this._hires = true;
                result = this.io.ioSwitch(off, val);
                this._debug('Hires on');
                break;

            default:
                result = this.io.ioSwitch(off, val);
                break;
        }
        this._updateBanks();

        return result;
    }

    _accessLangCard(off: byte, val?: byte) {
        const readMode = val === undefined;
        const result = readMode ? 0 : undefined;

        const writeSwitch = off & 0x01;
        const offSwitch = off & 0x02;
        const bank1Switch = off & 0x08;

        let bankStr;
        let rwStr;

        if (writeSwitch) { // 0xC081, 0xC083
            if (readMode) {
                this._writebsr = this._prewrite;
            }
            this._prewrite = readMode;

            if (offSwitch) { // 0xC08B
                this._readbsr = true;
                rwStr = 'Read/Write';
            } else {
                this._readbsr = false;
                rwStr = 'Write';
            }
        } else { // 0xC080, 0xC082
            this._writebsr = false;
            this._prewrite = false;

            if (offSwitch) { // 0xC082
                this._readbsr = false;
                rwStr = 'Off';
            } else { // 0xC080
                this._readbsr = true;
                rwStr = 'Read';
            }
        }

        if (bank1Switch) {
            this._bank1 = true;
            bankStr = 'Bank 1';
        } else {
            this._bank1 = false;
            bankStr = 'Bank 2';
        }

        this._debug(bankStr, rwStr);
        this._updateBanks();

        return result;
    }

    /*
     * The Big Switch
     */

    _access(off: byte, val?: byte) {
        let result;
        const writeMode = val !== undefined;
        const highNibble = off >> 4;

        switch (highNibble) {
            case 0x0:
                if (writeMode) {
                    this._accessMMUSet(off, val);
                } else {
                    result = this.io.ioSwitch(off);
                }
                break;

            case 0x1:
                if (writeMode) {
                    this.io.ioSwitch(off, val);
                } else {
                    result = this._accessStatus(off, val);
                }
                break;

            case 0x5:
                result = this._accessGraphics(off, val);
                break;

            case 0x7:
                result = this._accessIOUDisable(off, val);
                break;

            case 0x8:
                result = this._accessLangCard(off, val);
                break;

            default:
                result = this.io.ioSwitch(off, val);
        }

        return result;
    }

    public start() {
        this.lores1.start();
        this.lores2.start();
        return 0x00;
    }

    public end() {
        return 0xff;
    }

    public reset() {
        debug('reset');
        this._initSwitches();
        this._updateBanks();
        this.vm.reset();
        this.io.reset();
    }

    public read(page: byte, off: byte) {
        if (page === 0xff && off === 0xfc && this._intcxrom) {
            this._initSwitches();
        }
        return this._readPages[page].read(page, off);
    }

    public write(page: byte, off: byte, val: byte) {
        this._writePages[page].write(page, off, val);
    }

    public writeBank(bank: number,page: byte, off: byte, val: byte) {
        this._pages[page][bank].write(page, off, val);
    }

    public resetVB() {
        this._vbEnd = this.cpu.getCycles() + 1000;
    }

    public getState(): MMUState {
        return {
            bank1: this._bank1,
            readbsr: this._readbsr,
            writebsr: this._writebsr,
            prewrite: this._prewrite,

            intcxrom: this._intcxrom,
            slot3rom: this._slot3rom,
            intc8rom: this._intc8rom,

            auxRamRead: this._auxRamRead,
            auxRamWrite: this._auxRamWrite,
            altzp: this._altzp,

            _80store: this._80store,
            page2: this._page2,
            hires: this._hires,

            mem00_01: [this.mem00_01[0].getState(), this.mem00_01[1].getState()],
            mem02_03: [this.mem02_03[0].getState(), this.mem02_03[1].getState()],
            mem0C_1F: [this.mem0C_1F[0].getState(), this.mem0C_1F[1].getState()],
            mem60_BF: [this.mem60_BF[0].getState(), this.mem60_BF[1].getState()],
            memD0_DF: [
                this.memD0_DF[0].getState(),
                this.memD0_DF[1].getState(),
                this.memD0_DF[2].getState(),
                this.memD0_DF[3].getState(),
                this.memD0_DF[4].getState()
            ],
            memE0_FF: [
                this.memE0_FF[0].getState(),
                this.memE0_FF[1].getState(),
                this.memE0_FF[2].getState()
            ]
        };
    }

    public setState(state: MMUState) {
        this._readbsr = state.readbsr;
        this._writebsr = state.writebsr;
        this._bank1 = state.bank1;
        this._prewrite = state.prewrite;

        this._intcxrom = state.intcxrom;
        this._slot3rom = state.slot3rom;
        this._intc8rom = state.intc8rom;

        this._auxRamRead = state.auxRamRead;
        this._auxRamWrite = state.auxRamWrite;
        this._altzp = state.altzp;

        this._80store = state._80store;
        this._page2 = state.page2;
        this._hires = state.hires;

        this.mem00_01[0].setState(state.mem00_01[0]);
        this.mem00_01[1].setState(state.mem00_01[1]);
        this.mem02_03[0].setState(state.mem02_03[0]);
        this.mem02_03[1].setState(state.mem02_03[1]);
        this.mem0C_1F[0].setState(state.mem0C_1F[0]);
        this.mem0C_1F[1].setState(state.mem0C_1F[1]);
        this.mem60_BF[0].setState(state.mem60_BF[0]);
        this.mem60_BF[1].setState(state.mem60_BF[1]);
        this.memD0_DF[0].setState(state.memD0_DF[0]);
        this.memD0_DF[1].setState(state.memD0_DF[1]);
        this.memD0_DF[2].setState(state.memD0_DF[2]);
        this.memD0_DF[3].setState(state.memD0_DF[3]);
        this.memD0_DF[4].setState(state.memD0_DF[4]);
        this.memE0_FF[0].setState(state.memE0_FF[0]);
        this.memE0_FF[1].setState(state.memE0_FF[1]);
        this.memE0_FF[2].setState(state.memE0_FF[2]);

        this._updateBanks();
    }
}
