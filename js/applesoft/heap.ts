import { byte, word, Memory } from 'js/types';
import { toHex } from 'js/util';
import { CURLINE, ARG, FAC, ARYTAB, STREND, TXTTAB, VARTAB } from './zeropage';

export type ApplesoftValue = word | string | ApplesoftArray;
export type ApplesoftArray = Array<ApplesoftValue>;

export enum VariableType {
    Float = 0,
    String = 1,
    Function = 2,
    Integer = 3,
}

export interface ApplesoftVariable {
    name: string;
    sizes?: number[];
    type: VariableType;
    value: ApplesoftValue | undefined;
}

export class ApplesoftHeap {
    constructor(private mem: Memory) {}

    private readByte(addr: word): byte {
        const page = addr >> 8;
        const off = addr & 0xff;

        if (page >= 0xc0) {
            throw new Error(`Address ${toHex(page)} out of range`);
        }

        return this.mem.read(page, off);
    }

    private readWord(addr: word): word {
        const lsb = this.readByte(addr);
        const msb = this.readByte(addr + 1);

        return (msb << 8) | lsb;
    }

    private readInt(addr: word): word {
        const msb = this.readByte(addr);
        const lsb = this.readByte(addr + 1);

        return (msb << 8) | lsb;
    }

    private readFloat(addr: word, { unpacked } = { unpacked: false }): number {
        let exponent = this.readByte(addr);
        if (exponent === 0) {
            return 0;
        }
        exponent = (exponent & 0x80 ? 1 : -1) * ((exponent & 0x7f) - 1);

        let msb = this.readByte(addr + 1);
        const sb3 = this.readByte(addr + 2);
        const sb2 = this.readByte(addr + 3);
        const lsb = this.readByte(addr + 4);
        let sign;
        if (unpacked) {
            const sb = this.readByte(addr + 5);
            sign = sb & 0x80 ? -1 : 1;
        } else {
            sign = msb & 0x80 ? -1 : 1;
        }
        msb &= 0x7f;
        const mantissa = (msb << 24) | (sb3 << 16) | (sb2 << 8) | lsb;

        return sign * (1 + mantissa / 0x80000000) * Math.pow(2, exponent);
    }

    private readString(len: byte, addr: word): string {
        let str = '';
        for (let idx = 0; idx < len; idx++) {
            str += String.fromCharCode(this.readByte(addr + idx) & 0x7f);
        }
        return str;
    }

    private readVar(addr: word) {
        const firstByte = this.readByte(addr);
        const lastByte = this.readByte(addr + 1);
        const firstLetter = firstByte & 0x7f;
        const lastLetter = lastByte & 0x7f;

        const name =
            String.fromCharCode(firstLetter) +
            (lastLetter ? String.fromCharCode(lastLetter) : '');
        const type = ((lastByte & 0x80) >> 7) | ((firstByte & 0x80) >> 6);

        return { name, type };
    }

    private readArray(addr: word, type: byte, sizes: number[]): ApplesoftArray {
        let strLen, strAddr;
        let value;
        const ary = [];
        const len = sizes[0];

        for (let idx = 0; idx < len; idx++) {
            if (sizes.length > 1) {
                value = this.readArray(addr, type, sizes.slice(1));
            } else {
                switch (type) {
                    case 0: // Real
                        value = this.readFloat(addr);
                        addr += 5;
                        break;
                    case 1: // String
                        strLen = this.readByte(addr);
                        strAddr = this.readWord(addr + 1);
                        value = this.readString(strLen, strAddr);
                        addr += 3;
                        break;
                    case 3: // Integer
                    default:
                        value = this.readInt(addr);
                        addr += 2;
                        break;
                }
            }
            ary[idx] = value;
        }
        return ary;
    }

    dumpInternals() {
        return {
            txttab: this.readWord(TXTTAB),
            fac: this.readFloat(FAC, { unpacked: true }),
            arg: this.readFloat(ARG, { unpacked: true }),
            curline: this.readWord(CURLINE),
        };
    }

    dumpVariables() {
        const simpleVariableTable = this.readWord(VARTAB);
        const arrayVariableTable = this.readWord(ARYTAB);
        const variableStorageEnd = this.readWord(STREND);
        // var stringStorageStart = readWord(0x6F);

        let addr;
        const vars: ApplesoftVariable[] = [];
        let value;
        let strLen, strAddr;

        for (addr = simpleVariableTable; addr < arrayVariableTable; addr += 7) {
            const { name, type } = this.readVar(addr);

            switch (type as VariableType) {
                case VariableType.Float:
                    value = this.readFloat(addr + 2);
                    break;
                case VariableType.String:
                    strLen = this.readByte(addr + 2);
                    strAddr = this.readWord(addr + 3);
                    value = this.readString(strLen, strAddr);
                    break;
                case VariableType.Function:
                    value = toHex(this.readWord(addr + 2));
                    value += ',' + toHex(this.readWord(addr + 4));
                    break;
                case VariableType.Integer:
                    value = this.readInt(addr + 2);
                    break;
            }
            vars.push({ name, type, value });
        }

        while (addr < variableStorageEnd) {
            const { name, type } = this.readVar(addr);
            const off = this.readWord(addr + 2);
            const dim = this.readByte(addr + 4);
            const sizes = [];
            for (let idx = 0; idx < dim; idx++) {
                sizes[idx] = this.readInt(addr + 5 + idx * 2);
            }
            value = this.readArray(addr + 5 + dim * 2, type, sizes);
            vars.push({ name, sizes, type, value });

            if (off < 1) {
                break;
            }
            addr += off;
        }

        return vars;
    }
}
