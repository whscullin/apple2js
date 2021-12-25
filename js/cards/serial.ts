import { debug, toHex } from '../util';
import { P7, P8A } from '../roms/cards/serial';
import type { byte, Card } from 'js/types';

const LOC = {
    STATUS: 0x80,
    DATA_1: 0x81,
    DATA_0: 0x82
} as const;

const SWITCHES = [
    0, // SW1 Baud bit 0
    0, // SW2 Baud bit 1
    0, // SW3 Baud bit 2  000 - 19200
    1, // SW4 CR Delay      1 - Disabled
    1, // SW5 Width bit 0
    1, // SW6 Width bit 1  11 - 40 Columns
    1, // SW7 Line feed     1 - Disabled
] as const;

export default class Serial implements Card {
    constructor() {
        debug('Serial Card');
    }

    private _access(off: byte, val: byte) {
        const nextBit = 1;
        let result = undefined;
        if (val === undefined) {
            result = 0;
            for (let idx = 0; idx < 7; idx++) {
                result >>= 1;
                result |= SWITCHES[idx] ? 0x80 : 0;
            }
            result >>= 1;
            result |= nextBit ? 0x80 : 0;

            switch (off & 0x83) {
                case LOC.STATUS:
                    break;
                case LOC.DATA_1:
                    debug('xmit 1');
                    break;
                case LOC.DATA_0:
                    debug('xmit 0');
                    break;
                default:
                    debug('Serial card unknown soft switch', toHex(off));
            }
        } else {
            debug('Serial card write to', toHex(off), toHex(val));
        }

        return result;
    }

    ioSwitch(off: byte, val: byte) {
        return this._access(off, val);
    }

    read(page: byte, off: byte) {
        if (page < 0xC8) {
            return P7[off];
        } else {
            return P8A[((page % 2) << 8) | off];
        }
    }
    write(_page: byte, _off: byte, _val: byte) {
    }

    getState() {
        return {};
    }

    setState(_: unknown) {
    }
}
