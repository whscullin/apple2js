import { byte, KnownKeys, Memory, word } from '../types';

type AppleSoftArray = Array<word | number | string | AppleSoftArray>

const LETTERS =
    '                                ' +
    ' !"#$%&\'()*+,-./0123456789:;<=>?' +
    '@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_' +
    '`abcdefghijklmnopqrstuvwxyz{|}~ ';

const TOKENS = {
    0x80: 'END',
    0x81: 'FOR',
    0x82: 'NEXT',
    0x83: 'DATA',
    0x84: 'INPUT',
    0x85: 'DEL',
    0x86: 'DIM',
    0x87: 'READ',
    0x88: 'GR',
    0x89: 'TEXT',
    0x8a: 'PR#',
    0x8b: 'IN#',
    0x8c: 'CALL',
    0x8d: 'PLOT',
    0x8e: 'HLIN',
    0x8f: 'VLIN',
    0x90: 'HGR2',
    0x91: 'HGR',
    0x92: 'HCOLOR=',
    0x93: 'HPLOT',
    0x94: 'DRAW',
    0x95: 'XDRAW',
    0x96: 'HTAB',
    0x97: 'HOME',
    0x98: 'ROT=',
    0x99: 'SCALE=',
    0x9a: 'SHLOAD',
    0x9b: 'TRACE',
    0x9c: 'NOTRACE',
    0x9d: 'NORMAL',
    0x9e: 'INVERSE',
    0x9f: 'FLASH',
    0xa0: 'COLOR=',
    0xa1: 'POP=',
    0xa2: 'VTAB',
    0xa3: 'HIMEM:',
    0xa4: 'LOMEM:',
    0xa5: 'ONERR',
    0xa6: 'RESUME',
    0xa7: 'RECALL',
    0xa8: 'STORE',
    0xa9: 'SPEED=',
    0xaa: 'LET',
    0xab: 'GOTO',
    0xac: 'RUN',
    0xad: 'IF',
    0xae: 'RESTORE',
    0xaf: '&',
    0xb0: 'GOSUB',
    0xb1: 'RETURN',
    0xb2: 'REM',
    0xb3: 'STOP',
    0xb4: 'ON',
    0xb5: 'WAIT',
    0xb6: 'LOAD',
    0xb7: 'SAVE',
    0xb8: 'DEF',
    0xb9: 'POKE',
    0xba: 'PRINT',
    0xbb: 'CONT',
    0xbc: 'LIST',
    0xbd: 'CLEAR',
    0xbe: 'GET',
    0xbf: 'NEW',
    0xc0: 'TAB(',
    0xc1: 'TO',
    0xc2: 'FN',
    0xc3: 'SPC(',
    0xc4: 'THEN',
    0xc5: 'AT',
    0xc6: 'NOT',
    0xc7: 'STEP',
    0xc8: '+',
    0xc9: '-',
    0xca: '*',
    0xcb: '/',
    0xcc: '^',
    0xcd: 'AND',
    0xce: 'OR',
    0xcf: '>',
    0xd0: '=',
    0xd1: '<',
    0xd2: 'SGN',
    0xd3: 'INT',
    0xd4: 'ABS',
    0xd5: 'USR',
    0xd6: 'FRE',
    0xd7: 'SCRN(',
    0xd8: 'PDL',
    0xd9: 'POS',
    0xda: 'SQR',
    0xdb: 'RND',
    0xdc: 'LOG',
    0xdd: 'EXP',
    0xde: 'COS',
    0xdf: 'SIN',
    0xe0: 'TAN',
    0xe1: 'ATN',
    0xe2: 'PEEK',
    0xe3: 'LEN',
    0xe4: 'STR$',
    0xe5: 'VAL',
    0xe6: 'ASC',
    0xe7: 'CHR$',
    0xe8: 'LEFT$',
    0xe9: 'RIGHT$',
    0xea: 'MID$'
} as const;

export default class ApplesoftDump {
    constructor(private mem: Memory) { }

    private readByte(addr: word): byte {
        const page = addr >> 8;
        const off = addr & 0xff;

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

    private readFloat(addr: word): number {
        let exponent = this.readByte(addr);
        if (exponent === 0) {
            return 0;
        }
        exponent = (exponent & 0x80 ? 1 : -1) * ((exponent & 0x7F) - 1);

        let msb =  this.readByte(addr + 1);
        const sb3 =  this.readByte(addr + 2);
        const sb2 =  this.readByte(addr + 3);
        const lsb =  this.readByte(addr + 4);
        const sign = msb & 0x80 ? -1 : 1;
        msb &= 0x7F;
        const mantissa = (msb << 24) | (sb3 << 16) | (sb2 << 8) | lsb;

        return sign * (1 + mantissa / 0x80000000) * Math.pow(2, exponent);
    }

    private readString(len: byte, addr: word): string {
        let str = '';
        for (let idx = 0; idx < len; idx++) {
            str += String.fromCharCode(this.readByte(addr + idx) & 0x7F);
        }
        return str;
    }

    private readVar(addr: word) {
        const firstByte = this.readByte(addr);
        const lastByte = this.readByte(addr + 1);
        const firstLetter = firstByte & 0x7F;
        const lastLetter = lastByte & 0x7F;

        const name =
            String.fromCharCode(firstLetter) +
            (lastLetter ? String.fromCharCode(lastLetter) : '');
        const type = (lastByte & 0x80) >> 7 | (firstByte & 0x80) >> 6;

        return { name, type };
    }

    private readArray(addr: word, type: byte, sizes: number[]): AppleSoftArray {
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

    dumpProgram() {
        let str = '';
        const start = this.readWord(0x67); // Start
        const end = this.readWord(0xaf); // End of program
        let addr = start;
        do {
            let line = '';
            const next = this.readWord(addr);
            addr += 2;
            const lineno = this.readWord(addr);
            addr += 2;

            line += lineno;
            line += ' ';
            let val = 0;
            do {
                if (addr < start || addr > end)
                    return str;

                val = this.readByte(addr++);
                if (val >= 0x80) {
                    line += ' ';
                    line += TOKENS[val as KnownKeys<typeof TOKENS>];
                    line += ' ';
                }
                else
                    line += LETTERS[val];
            } while (val);
            line += '\n';
            str += line;
            addr = next;
        } while (addr && addr >= start && addr < end);

        return str;
    }

    dumpVariables() {
        const simpleVariableTable = this.readWord(0x69);
        const arrayVariableTable = this.readWord(0x6B);
        const variableStorageEnd = this.readWord(0x6D);
        // var stringStorageStart = readWord(0x6F);

        let addr;
        const vars = [];
        let value;
        let strLen, strAddr;

        for (addr = simpleVariableTable; addr < arrayVariableTable; addr += 7) {
            const { name, type } = this.readVar(addr);

            switch (type) {
                case 0: // Real
                    value = this.readFloat(addr + 2);
                    break;
                case 1: // String
                    strLen = this.readByte(addr + 2);
                    strAddr = this.readWord(addr + 3);
                    value = this.readString(strLen, strAddr);
                    break;
                case 3: // Integer
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

            addr += off;
        }

        return vars;
    }

    toString() {
        return this.dumpProgram();
    }
}
