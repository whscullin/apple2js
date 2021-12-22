import ROM from 'js/roms/rom';
import { bit, byte } from 'js/types';
import { debug } from '../util';

const PATTERN = [
    0xC5, 0x3A, 0xA3, 0x5C, 0xC5, 0x3A, 0xA3, 0x5C
];

const A0 = 0x01;
const A2 = 0x04;

export default class NoSlotClock {
    bits: bit[] = [];
    pattern = new Array(64);
    patternIdx: number = 0;

    constructor(private rom: ROM) {
        debug('NoSlotClock');
    }


    private patternMatch() {
        for (let idx = 0; idx < 8; idx++) {
            let byte = 0;
            for (let jdx = 0; jdx < 8; jdx++) {
                byte >>= 1;
                byte |= this.pattern.shift() ? 0x80 : 0x00;
            }
            if (byte !== PATTERN[idx]) {
                return false;
            }
        }
        return true;
    }

    private calcBits() {
        const shift = (val: byte) => {
            for (let idx = 0; idx < 4; idx++) {
                this.bits.push(val & 0x08 ? 0x01 : 0x00);
                val <<= 1;
            }
        };
        const shiftBCD = (val: byte) => {
            shift(Math.floor(val / 10));
            shift(Math.floor(val % 10));
        };

        const now = new Date();
        const year = now.getFullYear() % 100;
        const day = now.getDate();
        const weekday = now.getDay() + 1;
        const month = now.getMonth() + 1;
        const hour = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        const hundredths = (now.getMilliseconds() / 10);

        this.bits = [];

        shiftBCD(year);
        shiftBCD(month);
        shiftBCD(day);
        shiftBCD(weekday);
        shiftBCD(hour);
        shiftBCD(minutes);
        shiftBCD(seconds);
        shiftBCD(hundredths);
    }

    access(off: byte) {
        if (off & A2) {
            this.patternIdx = 0;
        } else {
            const bit = off & A0;
            this.pattern[this.patternIdx++] = bit;
            if (this.patternIdx === 64) {
                if (this.patternMatch()) {
                    this.calcBits();
                }
                this.patternIdx = 0;
            }
        }
    }

    start() {
        return this.rom.start();
    }

    end() {
        return this.rom.end();
    }

    read(page: byte, off: byte) {
        if (this.bits.length > 0) {
            const bit = this.bits.pop();
            return bit;
        } else {
            this.access(off);
        }
        return this.rom.read(page, off);
    }

    write(_page: byte, off: byte, _val: byte) {
        this.access(off);
        this.rom.write();
    }

    getState() {
        return {};
    }

    setState(_: unknown) {
    }
}

