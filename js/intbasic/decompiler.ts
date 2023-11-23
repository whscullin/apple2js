import { byte, word } from 'js/types';

const LETTERS =
    '                                ' +
    ' !"#$%&\'()*+,-./0123456789:;<=>?' +
    '@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_' +
    '`abcdefghijklmnopqrstuvwxyz{|}~ ';

const TOKENS: Record<byte, string> = {
    0x00: 'HIMEM:',
    0x01: '$01',
    0x02: '_',
    0x03: ':',
    0x04: 'LOAD',
    0x05: 'SAVE',
    0x06: 'CON',
    0x07: 'RUN',
    0x08: 'RUN',
    0x09: 'DEL',
    0x0a: ',',
    0x0b: 'NEW',
    0x0c: 'CLR',
    0x0d: 'AUTO',
    0x0e: ',',
    0x0f: 'MAN',
    0x10: 'HIMEM:',
    0x11: 'LOMEM:',
    0x12: '+',
    0x13: '-',
    0x14: '*',
    0x15: '/',
    0x16: '=',
    0x17: '#',
    0x18: '>=',
    0x19: '>',
    0x1a: '<=',
    0x1b: '<>',
    0x1c: '<',
    0x1d: 'AND',
    0x1e: 'OR',
    0x1f: 'MOD',
    0x20: '^',
    0x21: '+',
    0x22: '(',
    0x23: ',',
    0x24: 'THEN',
    0x25: 'THEN',
    0x26: ',',
    0x27: ',',
    0x28: '"',
    0x29: '"',
    0x2a: '(',
    0x2b: '!',
    0x2c: '!',
    0x2d: '(',
    0x2e: 'PEEK',
    0x2f: 'RND',
    0x30: 'SGN',
    0x31: 'ABS',
    0x32: 'PDL',
    0x33: 'RNDX',
    0x34: '(',
    0x35: '+',
    0x36: '-',
    0x37: 'NOT',
    0x38: '(',
    0x39: '=',
    0x3a: '#',
    0x3b: 'LEN(',
    0x3c: 'ASC(',
    0x3d: 'SCRN(',
    0x3e: ',',
    0x3f: '(',
    0x40: '$',
    0x41: '$',
    0x42: '(',
    0x43: ',',
    0x44: ',',
    0x45: ';',
    0x46: ';',
    0x47: ';',
    0x48: ',',
    0x49: ',',
    0x4a: ',',
    0x4b: 'TEXT',
    0x4c: 'GR',
    0x4d: 'CALL',
    0x4e: 'DIM',
    0x4f: 'DIM',
    0x50: 'TAB',
    0x51: 'END',
    0x52: 'INPUT',
    0x53: 'INPUT',
    0x54: 'INPUT',
    0x55: 'FOR',
    0x56: '=',
    0x57: 'TO',
    0x58: 'STEP',
    0x59: 'NEXT',
    0x5a: ',',
    0x5b: 'RETURN',
    0x5c: 'GOSUB',
    0x5d: 'REM',
    0x5e: 'LET',
    0x5f: 'GOTO',
    0x60: 'IF',
    0x61: 'PRINT',
    0x62: 'PRINT',
    0x63: 'PRINT',
    0x64: 'POKE',
    0x65: ',',
    0x66: 'COLOR=',
    0x67: 'PLOT',
    0x68: ',',
    0x69: 'HLIN',
    0x6a: ',',
    0x6b: 'AT',
    0x6c: 'VLIN',
    0x6d: ',',
    0x6e: 'AT',
    0x6f: 'VTAB',
    0x70: '=',
    0x71: '=',
    0x72: ')',
    0x73: ')',
    0x74: 'LIST',
    0x75: ',',
    0x76: 'LIST',
    0x77: 'POP',
    0x78: 'NODSP',
    0x79: 'NODSP',
    0x7a: 'NOTRACE',
    0x7b: 'DSP',
    0x7c: 'DSP',
    0x7d: 'TRACE',
    0x7e: 'PR#',
    0x7f: 'IN#',
};

export default class IntBasicDump {
    constructor(private data: Uint8Array) {}

    private readByte(addr: word) {
        return this.data[addr];
    }

    private readWord(addr: word) {
        const lsb = this.readByte(addr);
        const msb = this.readByte(addr + 1);

        return (msb << 8) | lsb;
    }

    toString() {
        let str = '';
        let addr = 0;
        const himem = this.data.length;
        do {
            let inRem = false;
            let inQuote = false;
            let isAlphaNum = false;
            /* const length = */ this.readByte(addr++);
            const lineno = this.readWord(addr);
            addr += 2;

            str += lineno;
            str += ' ';
            let val = 0;
            do {
                val = this.readByte(addr++);
                if (
                    !inRem &&
                    !inQuote &&
                    !isAlphaNum &&
                    val >= 0xb0 &&
                    val <= 0xb9
                ) {
                    str += this.readWord(addr);
                    addr += 2;
                } else if (val < 0x80 && val > 0x01) {
                    const t = TOKENS[val];
                    if (t.length > 1) {
                        str += ' ';
                    }
                    str += t;
                    if (t.length > 1) {
                        str += ' ';
                    }
                    if (val === 0x28) {
                        inQuote = true;
                    }
                    if (val === 0x29) {
                        inQuote = false;
                    }
                    if (val === 0x5d) {
                        inRem = true;
                    }
                    isAlphaNum = false;
                } else if (val > 0x80) {
                    const char = LETTERS[val - 0x80];
                    str += char;
                    isAlphaNum = /[A-Z0-9]/.test(char);
                }
            } while (val !== 0x01);
            str += '\n';
        } while (addr < himem);

        return str;
    }
}
