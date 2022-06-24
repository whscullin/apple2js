import { byte, KnownValues, Memory, word } from '../types';
import { STRING_TO_TOKEN } from './tokens';
import { TXTTAB, PRGEND, VARTAB, ARYTAB, STREND } from './zeropage';

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
}

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
    private prevChar: number = 0;
    constructor(private readonly line: string, private curChar: number = 0) { }

    [Symbol.iterator](): IterableIterator<string> {
        return this;
    }

    clone(): LineBuffer {
        return new LineBuffer(this.line, this.curChar);
    }

    next(): IteratorResult<string> {
        if (this.atEnd()) {
            return { done: true, value: undefined };
        }
        this.prevChar = this.curChar;
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
        const oldCurChar = this.curChar;
        const oldPrevChar = this.prevChar;
        let possibleToken = '';
        for (const char of this) {
            if (char === ' ') {
                continue;
            }
            possibleToken += char;
            if (possibleToken.length === token.length) {
                break;
            }
        }
        if (possibleToken.toUpperCase() === token) {
            // Matched; set prevChar to before the match.
            this.prevChar = oldCurChar;
            return true;
        }
        // No match; restore state.
        this.curChar = oldCurChar;
        this.prevChar = oldPrevChar;
        return false;
    }

    backup() {
        this.curChar = this.prevChar;
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
                lineBuffer.backup();
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
        for (const possibleToken in STRING_TO_TOKEN) {
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
                        return STRING_TO_TOKEN['ATN'];
                    }
                    // TO takes precedence over AT
                    if (lookAhead === 'O') {
                        // Backup to before the token
                        lineBuffer.backup();
                        // and emit the 'A' (upper- or lower-case)
                        return lineBuffer.next().value.charCodeAt(0);
                    }
                }
                return STRING_TO_TOKEN[possibleToken];
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

                    // Shorthand for PRINT (D580 in Apple //e ROM)
                    if (character === '?') {
                        result.push(STRING_TO_TOKEN['PRINT']);
                        break;
                    }

                    // Try to parse a token or character
                    lineBuffer.backup();
                    {
                        const token = this.readToken(lineBuffer);
                        if (token === STRING_TO_TOKEN['REM']) {
                            state = STATES.COMMENT;
                        }
                        if (token === STRING_TO_TOKEN['DATA']) {
                            state = STATES.DATA;
                        }
                        result.push(token);
                    }
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
