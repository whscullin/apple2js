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

import RAM, { RAMState } from '../ram';
import { debug } from '../util';
import { Card, Memory, byte, Restorable } from '../types';

export interface LanguageCardState {
    bank1: RAMState;
    bank2: RAMState;
    ram: RAMState;

    readbsr: boolean;
    writebsr: boolean;
    bsr2: boolean;
    prewrite: boolean;
}

export default class LanguageCard implements Card, Restorable<LanguageCardState> {
    LOC = {
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
    }

    private bank1: RAM;
    private bank2: RAM;
    private ram: RAM;

    private readbsr = false;
    private writebsr = false;
    private bsr2 = false;
    private prewrite = false;

    private read1: Memory;
    private read2: Memory;

    private write1: Memory;
    private write2: Memory;

    constructor(private rom: Memory) {
        debug('Language card');

        this.bank1 = new RAM(0xd0, 0xdf);
        this.bank2 = new RAM(0xd0, 0xdf);
        this.ram = new RAM(0xe0, 0xff);

        this.write1 = this.rom;
        this.write2 = this.rom;

        this.read1 = this.rom;
        this.read2 = this.rom;
    }

    private debug(..._args: any[]) {
        // debug.apply(null, arguments);
    }


    updateBanks() {
        if (this.readbsr) {
            this.read1 = this.bsr2 ? this.bank2 : this.bank1;
            this.read2 = this.ram;
        } else {
            this.read1 = this.rom;
            this.read2 = this.rom;
        }

        if (this.writebsr) {
            this.write1 = this.bsr2 ? this.bank2 : this.bank1;
            this.write2 = this.ram;
        } else {
            this.write1 = this.rom;
            this.write2 = this.rom;
        }
    }

    private access(off: byte, val: byte) {
        const readMode = val === undefined;
        const result = readMode ? 0 : undefined;

        switch (off & 0x8B) {
            case this.LOC.READBSR2: // 0xC080
                this.readbsr = true;
                this.writebsr = false;
                this.bsr2 = true;
                this.prewrite = false;
                this.debug('Bank 2 Read');
                break;
            case this.LOC.WRITEBSR2: // 0xC081
                this.readbsr = false;
                if (readMode) {
                    this.writebsr = this.prewrite;
                }
                this.bsr2 = true;
                this.prewrite = readMode;
                this.debug('Bank 2 Write');
                break;
            case this.LOC.OFFBSR2: // 0xC082
                this.readbsr = false;
                this.writebsr = false;
                this.bsr2 = true;
                this.prewrite = false;
                this.debug('Bank 2 Off');
                break;
            case this.LOC.READWRBSR2: // 0xC083
                this.readbsr = true;
                if (readMode) {
                    this.writebsr = this.prewrite;
                }
                this.bsr2 = true;
                this.prewrite = readMode;
                this.debug('Bank 2 Read/Write');
                break;

            case this.LOC.READBSR1: // 0xC088
                this.readbsr = true;
                this.writebsr = false;
                this.bsr2 = false;
                this.prewrite = false;
                this.debug('Bank 1 Read');
                break;
            case this.LOC.WRITEBSR1: // 0xC089
                this.readbsr = false;
                if (readMode) {
                    this.writebsr = this.prewrite;
                }
                this.bsr2 = false;
                this.prewrite = readMode;
                this.debug('Bank 1 Write');
                break;
            case this.LOC.OFFBSR1: // 0xC08A
                this.readbsr = false;
                this.writebsr = false;
                this.bsr2 = false;
                this.prewrite = false;
                this.debug('Bank 1 Off');
                break;
            case this.LOC.READWRBSR1: // 0xC08B
                this.readbsr = true;
                if (readMode) {
                    this.writebsr = this.prewrite;
                }
                this.bsr2 = false;
                this.prewrite = readMode;
                this.debug('Bank 1 Read/Write');
                break;
            default:
                break;
        }

        this.updateBanks();

        return result;
    }

    start() {
        return 0xd0;
    }

    end() {
        return 0xff;
    }

    ioSwitch(off: byte, val: byte) {
        return this.access(off, val);
    }

    read(page: byte, off: byte): byte {
        let result = 0;
        if (page < 0xe0) {
            result = this.read1.read(page, off);
        } else {
            result = this.read2.read(page, off);
        }
        return result;
    }

    write(page: byte, off: byte, val: byte) {
        if (page < 0xe0) {
            this.write1.write(page, off, val);
        } else {
            this.write2.write(page, off, val);
        }
    }

    getState() {
        return {
            readbsr: this.readbsr,
            writebsr: this.writebsr,
            bsr2: this.bsr2,
            prewrite: this.prewrite,
            ram: this.ram.getState(),
            bank1: this.bank1.getState(),
            bank2: this.bank2.getState()
        };
    }

    setState(state: LanguageCardState) {
        this.readbsr = state.readbsr;
        this.writebsr = state.writebsr;
        this.bsr2 = state.bsr2;
        this.prewrite = state.prewrite;
        this.ram.setState(state.ram);
        this.bank1.setState(state.bank1);
        this.bank2.setState(state.bank2);
        this.updateBanks();
    }
}
