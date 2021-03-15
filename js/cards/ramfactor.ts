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

import { allocMem, debug } from '../util';
import { Card, Restorable, byte, memory } from '../types';
import { rom } from '../roms/cards/ramfactor';

const LOC = {
    // Disk II Stuff
    RAMLO: 0x80,
    RAMMID: 0x81,
    RAMHI: 0x82,
    RAMDATA: 0x83,
    _RAMLO: 0x84,
    _RAMMID: 0x85,
    _RAMHI: 0x86,
    _RAMDATA: 0x87,
    BANK: 0x8F
} as const;

export class RAMFactorState {
    loc: number
    firmware: byte
    mem: memory
}

export default class RAMFactor implements Card, Restorable<RAMFactorState> {
    private mem: memory;

    private firmware = 0;
    private ramlo = 0;
    private rammid = 0;
    private ramhi = 0;

    private loc = 0;

    constructor(size: number) {
        debug('RAMFactor card');

        this.mem = allocMem(size);
        for (let off = 0; off < size; off++) {
            this.mem[off] = 0;
        }
    }

    private sethi(val: byte) {
        this.ramhi = (val & 0xff);
    }

    private setmid(val: byte) {
        if (((this.rammid & 0x80) !== 0) && ((val & 0x80) === 0)) {
            this.sethi(this.ramhi + 1);
        }
        this.rammid = (val & 0xff);
    }

    private setlo(val: byte) {
        if (((this.ramlo & 0x80) !== 0) && ((val & 0x80) === 0)) {
            this.setmid(this.rammid + 1);
        }
        this.ramlo = (val & 0xff);
    }

    private access(off: byte, val: byte) {
        let result = 0;
        switch (off & 0x8f) {
            case LOC.RAMLO:
            case LOC._RAMLO:
                if (val !== undefined) {
                    this.setlo(val);
                } else {
                    result = this.ramlo;
                }
                break;
            case LOC.RAMMID:
            case LOC._RAMMID:
                if (val !== undefined) {
                    this.setmid(val);
                } else {
                    result = this.rammid;
                }
                break;
            case LOC.RAMHI:
            case LOC._RAMHI:
                if (val !== undefined) {
                    this.sethi(val);
                } else {
                    result = this.ramhi;
                    result |= 0xf0;
                }
                break;
            case LOC.RAMDATA:
            case LOC._RAMDATA:
                if (val !== undefined) {
                    this.mem[this.loc % this.mem.length] = val;
                } else {
                    result = this.mem[this.loc % this.mem.length];
                }
                this.setlo(this.ramlo + 1);
                break;
            case LOC.BANK:
                if (val !== undefined) {
                    this.firmware = val & 0x01;
                } else {
                    result = this.firmware;
                }
                break;
            default:
                break;
        }
        this.loc = (this.ramhi << 16) | (this.rammid << 8) | (this.ramlo);

        /*
        if (val === undefined) {
            debug("Read: " + toHex(result) + " from " + toHex(off) + " (loc = " + _loc + ")");
        } else {
            debug("Wrote: " + toHex(val) + " to " + toHex(off) + " (loc = " + _loc + ")");
        }
        */

        return result;
    }

    ioSwitch(off: byte, val: byte) {
        return this.access(off, val);
    }

    read(page: byte, off: byte) {
        return rom[this.firmware << 12 | (page - 0xC0) << 8 | off];
    }

    write() {}

    reset() {
        this.firmware = 0;
    }

    getState() {
        return {
            loc: this.loc,
            firmware: this.firmware,
            mem: new Uint8Array(this.mem)
        };
    }

    setState(state: RAMFactorState) {
        this.loc = state.loc;
        this.firmware = state.firmware;
        this.mem = new Uint8Array(state.mem);

        this.ramhi = (this.loc >> 16) & 0xff;
        this.rammid = (this.loc >> 8) & 0xff;
        this.ramlo = (this.loc) & 0xff;
    }
}
