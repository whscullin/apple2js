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
        // debug.apply(null, args);
    }

    private updateBanks() {
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

    // Bank 2
    // READBSR2: 0x80
    // WRITEBSR2: 0x81
    // OFFBSR2: 0x82
    // READWRBSR2: 0x83

    // Bank 1
    // READBSR1: 0x88
    // WRITEBSR1: 0x89
    // OFFBSR1: 0x8a
    // READWRBSR1: 0x8b

    private access(off: byte, val?: byte) {
        const readMode = val === undefined;
        const result = readMode ? 0 : undefined;

        const writeSwitch = off & 0x01;
        const offSwitch = off & 0x02;
        const bank1Switch = off & 0x08;

        let bankStr;
        let rwStr;

        if (writeSwitch) { // $C081, $C083, $C089, $C08B
            if (readMode) {
                this.writebsr = this.prewrite;
            }
            this.prewrite = readMode;

            if (offSwitch) { // $C083, $C08B
                this.readbsr = true;
                rwStr = 'Read/Write';
            } else { // $C081, $C089
                this.readbsr = false;
                rwStr = 'Write';
            }
        } else { // $C080, $C082, $C088, $C08A
            this.writebsr = false;
            this.prewrite = false;

            if (offSwitch) { // $C082, $C08A
                this.readbsr = false;
                rwStr = 'Off';
            } else { // $C080, $C088
                this.readbsr = true;
                rwStr = 'Read';
            }
        }

        if (bank1Switch) { // C08[8-C]
            this.bsr2 = false;
            bankStr = 'Bank 1';
        } else { // C08[0-3]
            this.bsr2 = true;
            bankStr = 'Bank 2';
        }

        this.debug(bankStr, rwStr);
        this.updateBanks();

        return result;
    }

    start() {
        return 0xd0;
    }

    end() {
        return 0xff;
    }

    ioSwitch(off: byte, val?: byte) {
        return this.access(off, val);
    }

    read(page: byte, off: byte): byte {
        let result: number = 0;
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
