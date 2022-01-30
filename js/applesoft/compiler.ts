import { byte, KnownValues, Memory, word } from '../types';

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

/** Start of program (word) */
const TXTTAB = 0x67;
/** Start of variables (word) */
const VARTAB = 0x69;
/** Start of arrays (word) */
const ARYTAB = 0x6B;
/** End of strings (word). (Strings are allocated down from HIMEM.) */
const STREND = 0x6D;
/**
 * End of program (word). This is actually 1 or 2 bytes past the three
 * zero bytes that end the program.
 */
const PRGEND = 0xAF;
/** Default address for program start */
const PROGRAM_START = 0x801;

/** Parse states. Starts in `NORMAL`. */
enum STATES {
    /**
     * Tries to tokenize the input. Transitions:
     *   * `"`: `STRING`
     *   * `REM`: `COMMENT`
     *   * `DATA`: `DATA`
     */
    NORMAL = 0,
    /**
     * Stores the input exactly. Tranistions:
     *   * `"`: `NORMAL`
     */
    STRING = 1,
    /** Stores the input exactly up until the end of the line. No transitions. */
    COMMENT = 2,
    /**
     * Stores the input exactly. Transitions:
     *   * `:`: `NORMAL`
     *   * `"`: `DATA_QUOTE`
     */
    DATA = 3,
    /**
     * Stores the input exactly. Transitions:
     *   * `"`: `DATA`
     */
    DATA_QUOTE = 4,
};

function writeByte(mem: Memory, addr: word, val: byte) {
    const page = addr >> 8;
    const off = addr & 0xff;

    return mem.write(page, off, val);
}

function writeWord(mem: Memory, addr: word, val: byte) {
    const lsb = val & 0xff;
    const msb = val >> 8;

    writeByte(mem, addr, lsb);
    writeByte(mem, addr + 1, msb);
}

class LineBuffer implements IterableIterator<string> {
    constructor(private readonly line: string, private curChar: number = 0) { }

    [Symbol.iterator](): IterableIterator<string> {
        return this;
    }

    clone(): LineBuffer {
        return new LineBuffer(this.line, this.curChar);
    }

    next(): IteratorResult<string> {
        if (this.curChar >= this.line.length) {
            return { done: true, value: undefined };
        }
        return { done: false, value: this.line[this.curChar++] };
    }

    /**
     * Tries to match the input token at the current buffer location. If
     * the token matches, the current buffer location is advanced passed
     * the token and this method returns `true`. Otherwise, this method
     * returns `false`.
     * 
     * The input is assumed to be an all-uppercase string and the tokens
     * in the buffer are uppercased before the comparison.
     * 
     * @param token An all-uppercase string to match.
     */
    lookingAtToken(token: string): boolean {
        // Back up one since next() has already consumed the first character.
        const possibleToken = this.line.substring(
            this.curChar, this.curChar + token.length).toUpperCase();
        if (possibleToken === token) {
            this.curChar += token.length;
            return true;
        }
        return false;
    }

    backup(chars: number = 1) {
        this.curChar = Math.max(this.curChar - chars, 0);
    }

    peek(): string {
        if (this.atEnd()) {
            throw new RangeError(`Reading past the end of ${this.line}`);
        }
        return this.line[this.curChar];
    }

    atEnd(): boolean {
        return this.curChar >= this.line.length;
    }
}

export default class ApplesoftCompiler {
    private lines: Map<number, byte[]> = new Map();

    constructor() { }

    /**
     * Loads an AppleSoft BASIC program into memory.
     * 
     * @param mem Memory, including zero page, into which the program is
     *     loaded.
     * @param program A string with a BASIC program to compile (tokenize).
     * @param programStart Optional start address of the program. Defaults to
     *     standard AppleSoft program address, 0x801.
     */
    static compileToMemory(mem: Memory, program: string, programStart: word = PROGRAM_START) {
        const compiler = new ApplesoftCompiler();
        compiler.compile(program);
        const compiledProgram: Uint8Array = compiler.program(programStart);

        for (let i = 0; i < compiledProgram.byteLength; i++) {
            writeByte(mem, programStart + i, compiledProgram[i]);
        }
        // Set zero page locations. Applesoft is weird because, when a line
        // is inserted, PRGEND is copied to VARTAB in the beginning, but then
        // VARTAB is manipulated to make space for the line, then PRGEND is
        // set from VARTAB. There's also a bug in NEW at D657 where the carry
        // flag is not cleared, so it can add 2 or 3. The upshot, though, is
        // that PRGEND and VARTAB end up being 1 or 2 bytes past the end of
        // the program. From my tests is the emulator, it's usually 1, so
        // that's what we're going with here.
        const prgend = programStart + compiledProgram.byteLength + 1;
        writeWord(mem, TXTTAB, programStart);
        writeWord(mem, PRGEND, prgend);
        writeWord(mem, VARTAB, prgend);
        writeWord(mem, ARYTAB, prgend);
        writeWord(mem, STREND, prgend);
    }

    private readLineNumber(lineBuffer: LineBuffer): number {
        let lineNoStr = '';

        for (const character of lineBuffer) {
            if (/\d/.test(character)) {
                lineNoStr += character;
            } else {
                break;
            }
        }
        if (lineNoStr.length === 0) {
            throw new Error('Missing line number');
        }

        return parseInt(lineNoStr, 10);
    }

    private readToken(lineBuffer: LineBuffer): byte {
        // Try to match a token
        for (const possibleToken in TOKENS) {
            if (lineBuffer.lookingAtToken(possibleToken)) {
                // NOTE(flan): This special token-preference
                // logic is straight from the AppleSoft BASIC
                // code (D5BE-D5CA in the Apple //e ROM).

                // Found a token
                if (possibleToken === 'AT' && !lineBuffer.atEnd()) {
                    const lookAhead = lineBuffer.peek();
                    // ATN takes precedence over AT
                    if (lookAhead === 'N') {
                        lineBuffer.next();
                        return TOKENS['ATN'];
                    }
                    // TO takes precedence over AT
                    if (lookAhead === 'O') {
                        // Backup to before the token
                        lineBuffer.backup(possibleToken.length);
                        // and emit the 'A' (upper- or lower-case)
                        return lineBuffer.next().value.charCodeAt(0);
                    }
                }
                return TOKENS[possibleToken as keyof typeof TOKENS];
            }
        }

        // If not a token, output the character upper-cased
        return lineBuffer.next().value.toUpperCase().charCodeAt(0);
    }

    private compileLine(line: string | null | undefined) {
        const result: byte[] = [];
        if (!line) {
            return;
        }

        const lineBuffer = new LineBuffer(line);
        let state: KnownValues<typeof STATES> = STATES.NORMAL;

        const lineNumber = this.readLineNumber(lineBuffer);
        if (lineNumber < 0 || lineNumber > 65535) {
            throw new Error('Line number out of range');
        }

        // Read the rest of the line
        for (const character of lineBuffer) {
            const charCode = character.charCodeAt(0);
            switch (state) {
                case STATES.NORMAL:
                    // Skip spaces
                    if (character === ' ') {
                        break;
                    }

                    // Transition to parsing a string
                    if (character === '"') {
                        result.push(charCode);
                        state = STATES.STRING;
                        break;
                    }

                    // Try to parse a token or character
                    lineBuffer.backup();
                    const token = this.readToken(lineBuffer);
                    if (token === TOKENS['REM']) {
                        state = STATES.COMMENT;
                    }
                    if (token === TOKENS['DATA']) {
                        state = STATES.DATA;
                    }
                    result.push(token);
                    break;
                case STATES.COMMENT:
                        result.push(character.charCodeAt(0));
                    break;
                case STATES.STRING:
                    if (character === '"') {
                        state = STATES.NORMAL;
                    }
                    result.push(character.charCodeAt(0));
                    break;
                case STATES.DATA:
                    if (character === ':') {
                        state = STATES.NORMAL;
                    }
                    if (character === '"') {
                        state = STATES.DATA_QUOTE;
                    }
                    result.push(character.charCodeAt(0));
                    break;
                case STATES.DATA_QUOTE:
                    if (character === '"') {
                        state = STATES.DATA;
                    }
                    result.push(character.charCodeAt(0));
                    break;
            }
        }

        this.lines.set(lineNumber, result);
    }

    compile(program: string) {
        const lines = program.split(/[\r\n]+/g);

        while (lines.length) {
            const line = lines.shift();
            this.compileLine(line);
        }
    }

    /** Returns the compiled program at the given start address. */
    program(programStart: word = PROGRAM_START): Uint8Array {
        const result: byte[] = [];

        // Lines can be inserted out of order, but they should be in order
        // when tokenized.
        const lineNumbers = [...this.lines.keys()].sort();

        for (const lineNo of lineNumbers) {
            const lineBytes = this.lines.get(lineNo)!;
            const nextLineAddr = programStart + result.length + 4
                + lineBytes.length + 1; // +1 for the zero at end of line
            result.push(nextLineAddr & 0xff, nextLineAddr >> 8);
            result.push(lineNo & 0xff, lineNo >> 8);
            result.push(...lineBytes);
            result.push(0x00);
        }
        result.push(0x00, 0x00);

        return new Uint8Array(result);
    }
}
