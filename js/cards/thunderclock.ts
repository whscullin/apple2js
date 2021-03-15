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

import { debug, toHex } from '../util';
import { Card, Restorable, byte } from '../types';
import { rom } from '../roms/cards/thunderclock';

const LOC = {
    CONTROL: 0x80,
    AUX: 0x88
} as const;

const COMMANDS = {
    MASK: 0x18,
    REGHOLD: 0x00,
    REGSHIFT: 0x08,
    TIMED: 0x18
} as const;

const FLAGS = {
    DATA: 0x01,
    CLOCK: 0x02,
    STROBE: 0x04
} as const;

export interface ThunderclockState {}

export default class Thunderclock implements Card, Restorable<ThunderclockState>
{
    constructor() {
        debug('Thunderclock');
    }

    private clock = false;
    private strobe = false;
    private shiftMode = false;
    private register = 0;
    private bits: boolean[] = [];
    private command: byte = COMMANDS.REGHOLD;

    private debug(..._args: any[]) {
        // debug.apply(this, arguments);
    }

    private calcBits() {
        const shift = (val: byte) => {
            for (let idx = 0; idx < 4; idx++) {
                this.bits.push((val & 0x08) !== 0);
                val <<= 1;
            }
        };

        const shiftBCD = (val: byte) => {
            shift(Math.floor(val / 10));
            shift(val % 10);
        };

        const now = new Date();
        const day = now.getDate();
        const weekday = now.getDay();
        const month = now.getMonth() + 1;
        const hour = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        this.bits = [];
        shift(month);
        shift(weekday);
        shiftBCD(day);
        shiftBCD(hour);
        shiftBCD(minutes);
        shiftBCD(seconds);
    }

    private shift() {
        if (this.shiftMode) {
            if (this.bits.pop()) {
                this.debug('shifting 1');
                this.register |= 0x80;
            } else {
                this.debug('shifting 0');
                this.register &= 0x7f;
            }
        }
    }

    private access(off: byte, val?: byte) {
        switch (off & 0x8F) {
            case LOC.CONTROL:
                if (val !== undefined) {
                    const strobe = val & FLAGS.STROBE ? true : false;
                    if (strobe !== this.strobe) {
                        this.debug('strobe', this.strobe ? 'high' : 'low');
                        if (strobe) {
                            this.command = val & COMMANDS.MASK;
                            switch (this.command) {
                                case COMMANDS.TIMED:
                                    this.debug('TIMED');
                                    this.calcBits();
                                    break;
                                case COMMANDS.REGSHIFT:
                                    this.debug('REGSHIFT');
                                    this.shiftMode = true;
                                    this.shift();
                                    break;
                                case COMMANDS.REGHOLD:
                                    this.debug('REGHOLD');
                                    this.shiftMode = false;
                                    break;
                                default:
                                    this.debug('Unknown command', toHex(this.command));
                            }
                        }
                    }

                    const clock = val & FLAGS.CLOCK ? true : false;

                    if (clock !== this.clock) {
                        this.clock = clock;
                        this.debug('clock', this.clock ? 'high' : 'low');
                        if (clock) {
                            this.shift();
                        }
                    }
                }
                break;
            case LOC.AUX:
                break;
        }
        return this.register;
    }

    read(page: byte, off: byte) {
        let result;
        if (page < 0xc8) {
            result = rom[off];
        } else {
            result = rom[(page - 0xc8) << 8 | off];
        }
        return result;
    }

    write() {
    }

    ioSwitch(off: byte, val?: byte) {
        return this.access(off, val);
    }

    getState() {
        return {};
    }

    setState() {}
}
