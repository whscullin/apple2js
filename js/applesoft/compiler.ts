import { byte, KnownKeys, KnownValues, Memory, word } from '../types';

/** Map from keyword to token. */
const TOKENS = {
    'END': 0x80,
    'FOR': 0x81,
    'NEXT': 0x82,
    'DATA': 0x83,
    'INPUT': 0x84,
    'DEL': 0x85,
    'DIM': 0x86,
    'READ': 0x87,
    'GR': 0x88,
    'TEXT': 0x89,
    'PR#': 0x8a,
    'IN#': 0x8b,
    'CALL': 0x8c,
    'PLOT': 0x8d,
    'HLIN': 0x8e,
    'VLIN': 0x8f,
    'HGR2': 0x90,
    'HGR': 0x91,
    'HCOLOR=': 0x92,
    'HPLOT': 0x93,
    'DRAW': 0x94,
    'XDRAW': 0x95,
    'HTAB': 0x96,
    'HOME': 0x97,
    'ROT=': 0x98,
    'SCALE=': 0x99,
    'SHLOAD': 0x9a,
    'TRACE': 0x9b,
    'NOTRACE': 0x9c,
    'NORMAL': 0x9d,
    'INVERSE': 0x9e,
    'FLASH': 0x9f,
    'COLOR=': 0xa0,
    'POP=': 0xa1,
    'VTAB': 0xa2,
    'HIMEM:': 0xa3,
    'LOMEM:': 0xa4,
    'ONERR': 0xa5,
    'RESUME': 0xa6,
    'RECALL': 0xa7,
    'STORE': 0xa8,
    'SPEED=': 0xa9,
    'LET': 0xaa,
    'GOTO': 0xab,
    'RUN': 0xac,
    'IF': 0xad,
    'RESTORE': 0xae,
    '&': 0xaf,
    'GOSUB': 0xb0,
    'RETURN': 0xb1,
    'REM': 0xb2,
    'STOP': 0xb3,
    'ON': 0xb4,
    'WAIT': 0xb5,
    'LOAD': 0xb6,
    'SAVE': 0xb7,
    'DEF': 0xb8,
    'POKE': 0xb9,
    'PRINT': 0xba,
    'CONT': 0xbb,
    'LIST': 0xbc,
    'CLEAR': 0xbd,
    'GET': 0xbe,
    'NEW': 0xbf,
    'TAB(': 0xc0,
    'TO': 0xc1,
    'FN': 0xc2,
    'SPC(': 0xc3,
    'THEN': 0xc4,
    'AT': 0xc5,
    'NOT': 0xc6,
    'STEP': 0xc7,
    '+': 0xc8,
    '-': 0xc9,
    '*': 0xca,
    '/': 0xcb,
    '^': 0xcc,
    'AND': 0xcd,
    'OR': 0xce,
    '>': 0xcf,
    '=': 0xd0,
    '<': 0xd1,
    'SGN': 0xd2,
    'INT': 0xd3,
    'ABS': 0xd4,
    'USR': 0xd5,
    'FRE': 0xd6,
    'SCRN(': 0xd7,
    'PDL': 0xd8,
    'POS': 0xd9,
    'SQR': 0xda,
    'RND': 0xdb,
    'LOG': 0xdc,
    'EXP': 0xdd,
    'COS': 0xde,
    'SIN': 0xdf,
    'TAN': 0xe0,
    'ATN': 0xe1,
    'PEEK': 0xe2,
    'LEN': 0xe3,
    'STR$': 0xe4,
    'VAL': 0xe5,
    'ASC': 0xe6,
    'CHR$': 0xe7,
    'LEFT$': 0xe8,
    'RIGHT$': 0xe9,
    'MID$': 0xea
} as const;

const LOMEM = 0x69;
const ARRAY_START = 0x6B;
const ARRAY_END = 0x6D;
const PROGRAM_START = 0x801;

const STATES = {
    NORMAL: 0,
    STRING: 1,
    COMMENT: 2,
    DATA: 3
} as const;

export default class ApplesoftCompiler {
    constructor(private mem: Memory) { }

    private writeByte(addr: word, val: byte) {
        const page = addr >> 8;
        const off = addr & 0xff;

        return this.mem.write(page, off, val);
    }

    private writeWord(addr: word, val: byte) {
        const lsb = val & 0xff;
        const msb = val >> 8;

        this.writeByte(addr, lsb);
        this.writeByte(addr + 1, msb);
    }

    compile(program: string) {
        const lineNos: { [line: string]: byte[]} = {};

        function compileLine(line: string | null | undefined, offset: number) {
            if (!line) {
                return [];
            }

            let state: KnownValues<typeof STATES> = STATES.NORMAL;
            const result = [0, 0, 0, 0];
            let curChar = 0;
            let character;
            let lineNoStr = '';

            while (line.length) {
                character = line.charAt(curChar);
                if (/\d/.test(character)) {
                    lineNoStr += character;
                    curChar++;
                } else {
                    break;
                }
            }

            while (curChar < line.length) {
                character = line.charAt(curChar).toUpperCase();
                switch (state) {
                    case STATES.NORMAL:
                        if (character !== ' ') {
                            if (character === '"') {
                                result.push(character.charCodeAt(0));
                                state = STATES.STRING;
                                curChar++;
                            } else {
                                let foundToken = '';
                                let tokenIdx = -1;
                                for (const possibleToken in TOKENS) {
                                    if (possibleToken.charAt(0) == character) {
                                        tokenIdx = curChar + 1;
                                        let idx = 1;
                                        while (idx < possibleToken.length) {
                                            if (line.charAt(tokenIdx) !== ' ') {
                                                if (line.charAt(tokenIdx).toUpperCase() !== possibleToken.charAt(idx)) {
                                                    break;
                                                }
                                                idx++;
                                            }
                                            tokenIdx++;
                                        }
                                        if (idx === possibleToken.length) {
                                            // Found a token
                                            if (possibleToken === 'AT') {
                                                const lookAhead = line.charAt(tokenIdx + 1).toUpperCase();
                                                // ATN takes precedence over AT
                                                if (lookAhead === 'N') {
                                                    foundToken = 'ATN';
                                                    tokenIdx++;
                                                }
                                                // TO takes precedence over AT
                                                if (lookAhead === 'O') {
                                                    result.push(lookAhead.charCodeAt(0));
                                                    foundToken = 'TO';
                                                    tokenIdx++;
                                                }
                                            }
                                            foundToken = possibleToken;
                                        }
                                    }
                                    if (foundToken) {
                                        break;
                                    }
                                }
                                if (foundToken) {
                                    result.push(TOKENS[foundToken as KnownKeys<typeof TOKENS>]);
                                    curChar = tokenIdx;
                                    if (foundToken === 'REM') {
                                        state = STATES.COMMENT;
                                    }
                                } else {
                                    result.push(character.charCodeAt(0));
                                    curChar++;
                                }
                            }
                        } else {
                            curChar++;
                        }
                        break;
                    case STATES.COMMENT:
                        result.push(character.charCodeAt(0));
                        curChar++;
                        break;
                    case STATES.STRING:
                        result.push(character.charCodeAt(0));
                        if (character == '"') {
                            state = STATES.NORMAL;
                        }
                        curChar++;
                        break;
                }
            }

            if (lineNoStr.length) {
                const lineNo = parseInt(lineNoStr, 10);
                if (lineNo < 0 || lineNo > 65535) {
                    throw new Error('Line number out of range');
                }
                if (lineNos[lineNoStr]) {
                    throw new Error('Duplicate line number');
                }
                lineNos[lineNoStr] = result;

                // Next line pointer
                result.push(0);
                const nextLine = offset + result.length;
                result[0] = nextLine & 0xff;
                result[1] = nextLine >> 8;

                // Line number
                result[2] = lineNo & 0xff;
                result[3] = lineNo >> 8;
            } else {
                throw new Error('Missing line number');
            }

            return result;
        }

        let compiled: number[] = [];
        const lines = program.split(/[\r\n]+/g);

        while (lines.length) {
            const line = lines.shift();
            const compiledLine = compileLine(line, PROGRAM_START + compiled.length);
            compiled = compiled.concat(compiledLine);
        }
        compiled.push(0, 0);

        for (let idx = 0; idx < compiled.length; idx++) {
            this.writeByte(PROGRAM_START + idx, compiled[idx]);
        }
        this.writeWord(LOMEM, PROGRAM_START + compiled.length);
        this.writeWord(ARRAY_START, PROGRAM_START + compiled.length);
        this.writeWord(ARRAY_END, PROGRAM_START + compiled.length);
    }
}
