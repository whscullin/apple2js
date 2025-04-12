import { CPU6502, MemoryPages } from '@whscullin/cpu6502';
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
    SLOTC3ROMOFF: 0x0a,
    SLOTC3ROMON: 0x0b,

    // 80 Column video
    CLR80VID: 0x0c, // clear 80 column mode
    SET80VID: 0x0d, // set 80 column mode
    CLRALTCH: 0x0e, // clear mousetext
    SETALTCH: 0x0f, // set mousetext

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

    RDTEXT: 0x1a, // using text mode
    RDMIXED: 0x1b, // using mixed mode
    RDPAGE2: 0x1c, // using text/graphics page2
    RDHIRES: 0x1d, // using Hi-res graphics mode
    RDALTCH: 0x1e, // using alternate character set
    RD80VID: 0x1f, // using 80-column display mode

    // Graphics
    PAGE1: 0x54, // select text/graphics page1 main/aux
    PAGE2: 0x55, // select text/graphics page2 main/aux
    RESET_HIRES: 0x56,
    SET_HIRES: 0x57,

    DHIRESON: 0x5e, // Enable double hires (CLRAN3)
    DHIRESOFF: 0x5f, // Disable double hires (SETAN3)

    // Misc
    BANK: 0x73, // Back switched RAM card bank

    IOUDISON: 0x7e, // W IOU Disable on / R7 IOU Disable
    IOUDISOFF: 0x7f, // W IOU Disable off / R7 Double Hires

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

class Switches implements Memory {
    constructor(private mmu: MMU) {}

    read(_page: byte, off: byte) {
        return this.mmu._access(off) || 0;
    }

    write(_page: byte, off: byte, val: byte) {
        this.mmu._access(off, val);
    }
}

class AuxRom implements Memory {
    constructor(
        private readonly mmu: MMU,
        private readonly rom: ROM
    ) {}

    _access(page: byte, off: byte) {
        if (page === 0xc3) {
            this.mmu._setIntc8rom(true);
            this.mmu._updateBanks();
        }
        if (page === 0xcf && off === 0xff) {
            this.mmu._setIntc8rom(false);
            this.mmu._updateBanks();
        }
    }

    read(page: byte, off: byte) {
        this._access(page, off);
        return this.rom.read(page, off);
    }

    write(page: byte, off: byte, _val: byte) {
        this._access(page, off);
    }
}

export interface MMUState {
    bank1: boolean;
    readbsr: boolean;
    writebsr: boolean;
    prewrite: boolean;

    intcxrom: boolean;
    slot3rom: boolean;
    intc8rom: boolean;

    auxRamRead: boolean;
    auxRamWrite: boolean;
    altzp: boolean;

    _80store: boolean;
    page2: boolean;
    hires: boolean;

    mem00_BF: [RAMState, RAMState];
    memD0_DF: [ROMState, RAMState, RAMState, RAMState, RAMState];
    memE0_FF: [ROMState, RAMState, RAMState];
}

export default class MMU implements Memory, Restorable<MMUState> {
    private _readPages = new Array<Memory>(0x100);
    private _writePages = new Array<Memory>(0x100);
    private _pages: Memory[][] = [
        new Array<Memory>(0x100),
        new Array<Memory>(0x100),
        new Array<Memory>(0x100),
        new Array<Memory>(0x100),
        new Array<Memory>(0x100),
    ];

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
    private __80store: boolean;
    private _page2: boolean;
    private _hires: boolean;

    private _iouDisable: boolean;

    private _vbEnd = 0;

    private switches = new Switches(this);
    private auxRom = new AuxRom(this, this.rom);

    // These fields represent the bank-switched memory ranges.
    private mem00_01: [MemoryPages, MemoryPages];
    private mem02_03: [MemoryPages, MemoryPages];
    private mem04_07: [MemoryPages, MemoryPages];
    private mem08_0B: [MemoryPages, MemoryPages];
    private mem0C_1F: [MemoryPages, MemoryPages];
    private mem20_3F: [MemoryPages, MemoryPages];
    private mem40_5F: [MemoryPages, MemoryPages];
    private mem60_BF: [MemoryPages, MemoryPages];
    private memC0_C0 = [this.switches];
    private memC1_CF = [this.io, this.auxRom];
    private memD0_DF: [ROM, RAM, RAM, RAM, RAM] = [
        this.rom,
        new RAM(0xd0, 0xdf),
        new RAM(0xd0, 0xdf),
        new RAM(0xd0, 0xdf),
        new RAM(0xd0, 0xdf),
    ];
    private memE0_FF: [ROM, RAM, RAM] = [
        this.rom,
        new RAM(0xe0, 0xff),
        new RAM(0xe0, 0xff),
    ];

    constructor(
        private readonly cpu: CPU6502,
        private readonly vm: VideoModes,
        private readonly lores1: LoresPage,
        private readonly lores2: LoresPage,
        private readonly hires1: HiresPage,
        private readonly hires2: HiresPage,
        private readonly io: Apple2IO,
        private readonly ram: RAM[],
        private readonly rom: ROM
    ) {
        this.mem00_01 = [this.ram[0], this.ram[1]];
        this.mem02_03 = [this.ram[0], this.ram[1]];
        this.mem04_07 = [this.lores1.bank0(), this.lores1.bank1()];
        this.mem08_0B = [this.lores2.bank0(), this.lores2.bank1()];
        this.mem0C_1F = [this.ram[0], this.ram[1]];
        this.mem20_3F = [this.hires1.bank0(), this.hires1.bank1()];
        this.mem40_5F = [this.hires2.bank0(), this.hires2.bank1()];
        this.mem60_BF = [this.ram[0], this.ram[1]];

        /*
         * Initialize read/write banks
         */

        // Zero Page/Stack
        for (let idx = 0x0; idx < 0x2; idx++) {
            this._pages[0][idx] = this.mem00_01[0];
            this._pages[1][idx] = this.mem00_01[1];
            this._readPages[idx] = this._pages[0][idx];
            this._writePages[idx] = this._pages[0][idx];
        }
        // 0x300-0x400
        for (let idx = 0x2; idx < 0x4; idx++) {
            this._pages[0][idx] = this.mem02_03[0];
            this._pages[1][idx] = this.mem02_03[1];
            this._readPages[idx] = this._pages[0][idx];
            this._writePages[idx] = this._pages[0][idx];
        }
        // Text Page 1
        for (let idx = 0x4; idx < 0x8; idx++) {
            this._pages[0][idx] = this.mem04_07[0];
            this._pages[1][idx] = this.mem04_07[1];
            this._readPages[idx] = this._pages[0][idx];
            this._writePages[idx] = this._pages[0][idx];
        }
        // Text Page 2
        for (let idx = 0x8; idx < 0xc; idx++) {
            this._pages[0][idx] = this.mem08_0B[0];
            this._pages[1][idx] = this.mem08_0B[1];
            this._readPages[idx] = this._pages[0][idx];
            this._writePages[idx] = this._pages[0][idx];
        }
        // 0xC00-0x2000
        for (let idx = 0xc; idx < 0x20; idx++) {
            this._pages[0][idx] = this.mem0C_1F[0];
            this._pages[1][idx] = this.mem0C_1F[1];
            this._readPages[idx] = this._pages[0][idx];
            this._writePages[idx] = this._pages[0][idx];
        }
        // Hires Page 1
        for (let idx = 0x20; idx < 0x40; idx++) {
            this._pages[0][idx] = this.mem20_3F[0];
            this._pages[1][idx] = this.mem20_3F[1];
            this._readPages[idx] = this._pages[0][idx];
            this._writePages[idx] = this._pages[0][idx];
        }
        // Hires Page 2
        for (let idx = 0x40; idx < 0x60; idx++) {
            this._pages[0][idx] = this.mem40_5F[0];
            this._pages[1][idx] = this.mem40_5F[1];
            this._readPages[idx] = this._pages[0][idx];
            this._writePages[idx] = this._pages[0][idx];
        }
        // 0x6000-0xc000
        for (let idx = 0x60; idx < 0xc0; idx++) {
            this._pages[0][idx] = this.mem60_BF[0];
            this._pages[1][idx] = this.mem60_BF[1];
            this._readPages[idx] = this._pages[0][idx];
            this._writePages[idx] = this._pages[0][idx];
        }
        // I/O Switches
        {
            const idx = 0xc0;
            this._pages[0][idx] = this.memC0_C0[0];
            this._pages[1][idx] = this.memC0_C0[0];
            this._readPages[idx] = this._pages[0][idx];
            this._writePages[idx] = this._pages[0][idx];
        }
        // Slots
        for (let idx = 0xc1; idx < 0xd0; idx++) {
            this._pages[0][idx] = this.memC1_CF[0];
            this._pages[1][idx] = this.memC1_CF[1];
            this._readPages[idx] = this._pages[0][idx];
            this._writePages[idx] = this._pages[0][idx];
        }
        // Basic ROM
        for (let idx = 0xd0; idx < 0xe0; idx++) {
            this._pages[0][idx] = this.memD0_DF[0];
            this._pages[1][idx] = this.memD0_DF[1];
            this._pages[2][idx] = this.memD0_DF[2];
            this._pages[3][idx] = this.memD0_DF[3];
            this._pages[4][idx] = this.memD0_DF[4];
            this._readPages[idx] = this._pages[0][idx];
            this._writePages[idx] = this._pages[0][idx];
        }
        // Monitor ROM
        for (let idx = 0xe0; idx < 0x100; idx++) {
            this._pages[0][idx] = this.memE0_FF[0];
            this._pages[1][idx] = this.memE0_FF[1];
            this._pages[2][idx] = this.memE0_FF[2];
            this._readPages[idx] = this._pages[0][idx];
            this._writePages[idx] = this._pages[0][idx];
        }
    }

    private _initSwitches() {
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

        this.__80store = false;
        this._page2 = false;
        this._hires = false;

        this._iouDisable = true;
    }

    private _debug(..._args: unknown[]) {
        // debug.apply(this, _args);
    }

    _setIntc8rom(on: boolean) {
        this._intc8rom = on;
    }

    _updateBanks() {
        let readPages: Memory[];
        let writePages: Memory[];

        readPages = this._auxRamRead ? this._pages[1] : this._pages[0];
        writePages = this._auxRamWrite ? this._pages[1] : this._pages[0];

        this._readPages = readPages.slice();
        this._writePages = writePages.slice();

        if (this.__80store) {
            readPages = this._page2 ? this._pages[1] : this._pages[0];
            writePages = this._page2 ? this._pages[1] : this._pages[0];
            for (let idx = 0x4; idx < 0x8; idx++) {
                this._readPages[idx] = readPages[idx];
                this._writePages[idx] = writePages[idx];
            }
            if (this._hires) {
                for (let idx = 0x20; idx < 0x40; idx++) {
                    this._readPages[idx] = readPages[idx];
                    this._writePages[idx] = writePages[idx];
                }
            }
        }

        if (this._intcxrom) {
            readPages = this._pages[1];
            writePages = this._pages[1];
            for (let idx = 0xc1; idx < 0xd0; idx++) {
                this._readPages[idx] = readPages[idx];
                this._writePages[idx] = writePages[idx];
            }
        } else {
            readPages = this._pages[0];
            writePages = this._pages[0];
            for (let idx = 0xc1; idx < 0xd0; idx++) {
                this._readPages[idx] = readPages[idx];
                this._writePages[idx] = writePages[idx];
            }
            if (!this._slot3rom) {
                readPages = this._pages[1];
                writePages = this._pages[1];
                this._readPages[0xc3] = readPages[0xc3];
                this._writePages[0xc3] = writePages[0xc3];
            }
            if (this._intc8rom) {
                readPages = this._pages[1];
                writePages = this._pages[1];
                for (let idx = 0xc8; idx < 0xd0; idx++) {
                    this._readPages[idx] = readPages[idx];
                    this._writePages[idx] = readPages[idx];
                }
            }
        }

        readPages = this._altzp ? this._pages[1] : this._pages[0];
        writePages = this._altzp ? this._pages[1] : this._pages[0];
        for (let idx = 0x0; idx < 0x2; idx++) {
            this._readPages[idx] = readPages[idx];
            this._writePages[idx] = writePages[idx];
        }

        if (this._readbsr) {
            readPages = this._bank1
                ? this._altzp
                    ? this._pages[2]
                    : this._pages[1]
                : this._altzp
                  ? this._pages[4]
                  : this._pages[3];
            for (let idx = 0xd0; idx < 0xe0; idx++) {
                this._readPages[idx] = readPages[idx];
            }
            readPages = this._altzp ? this._pages[2] : this._pages[1];
            for (let idx = 0xe0; idx < 0x100; idx++) {
                this._readPages[idx] = readPages[idx];
            }
        } else {
            readPages = this._pages[0];
            for (let idx = 0xd0; idx < 0x100; idx++) {
                this._readPages[idx] = readPages[idx];
            }
        }

        if (this._writebsr) {
            writePages = this._bank1
                ? this._altzp
                    ? this._pages[2]
                    : this._pages[1]
                : this._altzp
                  ? this._pages[4]
                  : this._pages[3];

            for (let idx = 0xd0; idx < 0xe0; idx++) {
                this._writePages[idx] = writePages[idx];
            }
            writePages = this._altzp ? this._pages[2] : this._pages[1];
            for (let idx = 0xe0; idx < 0x100; idx++) {
                this._writePages[idx] = writePages[idx];
            }
        } else {
            writePages = this._pages[0];
            for (let idx = 0xd0; idx < 0x100; idx++) {
                this._writePages[idx] = writePages[idx];
            }
        }
    }

    // Apple //e memory management

    private _accessMMUSet(off: byte, _val?: byte) {
        switch (off) {
            case LOC._80STOREOFF:
                this.__80store = false;
                this._debug('80 Store Off', _val);
                this.vm.page(this._page2 ? 2 : 1);
                break;
            case LOC._80STOREON:
                this.__80store = true;
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
                if (this._slot3rom) {
                    this._intc8rom = false;
                }
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
                this.vm.altChar(false);
                break;
            case LOC.SETALTCH:
                this._debug('Alt Char on');
                this.vm.altChar(true);
                break;
        }
        this._updateBanks();
    }

    // Status registers

    private _accessStatus(off: byte, val?: byte) {
        let result = undefined;

        switch (off) {
            case LOC.BSRBANK2:
                this._debug(`Bank 2 Read ${!this._bank1 ? 'true' : 'false'}`);
                result = !this._bank1 ? 0x80 : 0x00;
                break;
            case LOC.BSRREADRAM:
                this._debug(
                    `Bank SW RAM Read ${this._readbsr ? 'true' : 'false'}`
                );
                result = this._readbsr ? 0x80 : 0x00;
                break;
            case LOC.RAMRD: // 0xC013
                this._debug(
                    `Aux RAM Read ${this._auxRamRead ? 'true' : 'false'}`
                );
                result = this._auxRamRead ? 0x80 : 0x0;
                break;
            case LOC.RAMWRT: // 0xC014
                this._debug(
                    `Aux RAM Write ${this._auxRamWrite ? 'true' : 'false'}`
                );
                result = this._auxRamWrite ? 0x80 : 0x0;
                break;
            case LOC.INTCXROM: // 0xC015
                // _debug('Int CX ROM ' + _intcxrom);
                result = this._intcxrom ? 0x80 : 0x00;
                break;
            case LOC.ALTZP: // 0xC016
                this._debug(`Alt ZP ${this._altzp ? 'true' : 'false'}`);
                result = this._altzp ? 0x80 : 0x0;
                break;
            case LOC.SLOTC3ROM: // 0xC017
                this._debug(`Slot C3 ROM ${this._slot3rom ? 'true' : 'false'}`);
                result = this._slot3rom ? 0x80 : 0x00;
                break;
            case LOC._80STORE: // 0xC018
                this._debug(`80 Store ${this.__80store ? 'true' : 'false'}`);
                result = this.__80store ? 0x80 : 0x00;
                break;
            case LOC.VERTBLANK: // 0xC019
                // result = cpu.getCycles() % 20 < 5 ? 0x80 : 0x00;
                result = this.cpu.getCycles() < this._vbEnd ? 0x80 : 0x00;
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

    private _accessIOUDisable(off: byte, val?: byte) {
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

    private _accessGraphics(off: byte, val?: byte) {
        let result: byte | undefined = 0;

        switch (off) {
            case LOC.PAGE1:
                this._page2 = false;
                if (!this.__80store) {
                    result = this.io.ioSwitch(off, val);
                }
                this._debug('Page 2 off');
                break;

            case LOC.PAGE2:
                this._page2 = true;
                if (!this.__80store) {
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

    private _accessLangCard(off: byte, val?: byte) {
        const readMode = val === undefined;
        const result = readMode ? 0 : undefined;

        const writeSwitch = off & 0x01;
        const offSwitch = off & 0x02;
        const bank1Switch = off & 0x08;

        let bankStr;
        let rwStr;

        if (writeSwitch) {
            // 0xC081, 0xC083
            if (readMode) {
                if (this._prewrite) {
                    this._writebsr = true;
                }
            }
            this._prewrite = readMode;

            if (offSwitch) {
                // 0xC08B
                this._readbsr = true;
                rwStr = 'Read/Write';
            } else {
                this._readbsr = false;
                rwStr = 'Write';
            }
        } else {
            // 0xC080, 0xC082
            this._writebsr = false;
            this._prewrite = false;

            if (offSwitch) {
                // 0xC082
                this._readbsr = false;
                rwStr = 'Off';
            } else {
                // 0xC080
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
        return this._readPages[page].read(page, off);
    }

    public write(page: byte, off: byte, val: byte) {
        this._writePages[page].write(page, off, val);
    }

    public writeBank(bank: number, page: byte, off: byte, val: byte) {
        this._pages[page][bank].write(page, off, val);
    }

    public resetVB() {
        this._vbEnd = this.cpu.getCycles() + 1000;
    }

    public get bank1() {
        return this._bank1;
    }

    public get readbsr() {
        return this._readbsr;
    }

    public get writebsr() {
        return this._writebsr;
    }

    public get auxread() {
        return this._auxRamRead;
    }

    public get auxwrite() {
        return this._auxRamWrite;
    }

    public get altzp() {
        return this._altzp;
    }

    public get _80store() {
        return this.__80store;
    }

    public get page2() {
        return this._page2;
    }

    public get hires() {
        return this._hires;
    }

    public get intcxrom() {
        return this._intcxrom;
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

            _80store: this.__80store,
            page2: this._page2,
            hires: this._hires,

            mem00_BF: [this.ram[0].getState(), this.ram[1].getState()],
            memD0_DF: [
                this.memD0_DF[0].getState(),
                this.memD0_DF[1].getState(),
                this.memD0_DF[2].getState(),
                this.memD0_DF[3].getState(),
                this.memD0_DF[4].getState(),
            ],
            memE0_FF: [
                this.memE0_FF[0].getState(),
                this.memE0_FF[1].getState(),
                this.memE0_FF[2].getState(),
            ],
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

        this.__80store = state._80store;
        this._page2 = state.page2;
        this._hires = state.hires;

        this.ram[0].setState(state.mem00_BF[0]);
        this.ram[1].setState(state.mem00_BF[1]);
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
