import { byte, KnownKeys, Memory, word } from '../types';

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

    toString() {
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
}
