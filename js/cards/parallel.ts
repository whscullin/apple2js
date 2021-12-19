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
