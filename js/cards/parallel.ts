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

import { debug } from '../util';
import { Card, Restorable, byte } from '../types';
import { rom } from '../roms/cards/parallel';

const LOC = {
    IOREG: 0x80
} as const;

export interface ParallelState {}
export interface ParallelOptions {
    putChar: (val: byte) => void;
}

export default class Parallel implements Card, Restorable<ParallelState> {
    constructor(private cbs: ParallelOptions) {
        debug('Parallel card');
    }

    private access(off: byte, val?: byte) {
        switch (off & 0x8f) {
            case LOC.IOREG:
                if (this.cbs.putChar && val) {
                    this.cbs.putChar(val);
                }
                break;
            default:
                debug('Parallel card unknown softswitch', off);
        }
        return 0;
    }

    ioSwitch(off: byte, val?: byte) {
        return this.access(off, val);
    }

    read(_page: byte, off: byte) {
        return rom[off];
    }

    write() {}

    getState() {
        return {};
    }

    setState(_state: ParallelState) {}
}
