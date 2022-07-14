import { byte, word, ReadonlyUint8Array, Memory } from '../types';
import { toHex } from 'js/util';
import { TOKEN_TO_STRING, STRING_TO_TOKEN } from './tokens';
import { TXTTAB, PRGEND } from './zeropage';

const LETTERS =
    '                                ' +
    ' !"#$%&\'()*+,-./0123456789:;<=>?' +
    '@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_' +
    '`abcdefghijklmnopqrstuvwxyz{|}~ ';

/**
 * Resolves a token value to a token string or character.
 *
 * @param token
 * @returns string representing token
 */
const resolveToken = (token: byte) => {
    let tokenString;
    if (token >= 0x80 && token <= 0xea) {
        tokenString = TOKEN_TO_STRING[token];
    } else if (LETTERS[token] !== undefined) {
        tokenString = LETTERS[token];
    } else {
        tokenString = `[${toHex(token)}]`;
    }
    return tokenString;
};

interface ListOptions {
    apple2: 'e' | 'plus';
    columns: number; // usually 40 or 80
}

const DEFAULT_LIST_OPTIONS: ListOptions = {
    apple2: 'e',
    columns: 40,
};

interface DecompileOptions {
    style: 'compact' | 'pretty';
}

const DEFAULT_DECOMPILE_OPTIONS: DecompileOptions = {
    style: 'pretty',
};

const MAX_LINES = 32768;

export default class ApplesoftDecompiler {

    /**
     * Returns a decompiler for the program in the given memory.
     *
     * The memory is assumed to have set `TXTTAB` and `PRGEND` correctly.
     */
    static decompilerFromMemory(ram: Memory): ApplesoftDecompiler {
        const program: byte[] = [];

        const start = ram.read(0x00, TXTTAB) + (ram.read(0x00, TXTTAB + 1) << 8);
        const end = ram.read(0x00, PRGEND) + (ram.read(0x00, PRGEND + 1) << 8);
        if (start >= 0xc000 || end >= 0xc000) {
            throw new Error(`Program memory ${toHex(start, 4)}-${toHex(end, 4)} out of range`);
        }
        for (let addr = start; addr <= end; addr++) {
            program.push(ram.read(addr >> 8, addr & 0xff));
        }

        return new ApplesoftDecompiler(new Uint8Array(program), start);
    }

    /**
     * Constructs a decompiler for the given program data. The data is
     * assumed to be a dump of memory beginning at `base`. If the data
     * does not cover the whole program, attempting to decompile will
     * fail.
     *
     * @param program The program bytes.
     * @param base
     */
    constructor(private readonly program: ReadonlyUint8Array,
        private readonly base: word = 0x801) {
    }

    /** Returns the 2-byte word at the given offset. */
    private wordAt(offset: word): word {
        return this.program[offset] + (this.program[offset + 1] << 8);
    }

    /**
     * Iterates through the lines of the given program in the order of
     * the linked list of lines, starting from the first line. This
     * does _not_ mean that all lines in memory will
     *
     * @param from First line for which to call the callback.
     * @param to Last line for which to call the callback.
     * @param callback A function to call for each line. The first parameter
     *     is the offset of the line number of the line; the tokens follow.
     */
    private forEachLine(
        from: number, to: number,
        callback: (offset: word) => void): void
    {
        let count = 0;
        let offset = 0;
        let nextLineAddr = this.wordAt(offset);
        let nextLineNo = this.wordAt(offset + 2);
        while (nextLineAddr !== 0 && nextLineNo < from) {
            if (++count > MAX_LINES) {
                throw new Error('Loop detected in listing');
            }
            offset = nextLineAddr;
            nextLineAddr = this.wordAt(offset);
            nextLineNo = this.wordAt(offset + 2);
        }
        while (nextLineAddr !== 0 && nextLineNo <= to) {
            if (++count > MAX_LINES) {
                throw new Error('Loop detected in listing');
            }
            callback(offset + 2);
            offset = nextLineAddr - this.base;
            nextLineAddr = this.wordAt(offset);
            nextLineNo = this.wordAt(offset + 2);
        }
    }

    /** Lists a single line like an Apple II. */
    listLine(offset: word, options: ListOptions): string {
        const lines: string[] = [];
        let line = '';

        const lineNo = this.wordAt(offset);
        // The Apple //e prints a space before each line number to make
        // it easier to edit the lines.  The change is at the subroutine
        // called at D6F9: on the //e it is SPCLIN (F7AA), on the ][+ it
        // is LINPRT (ED24).
        if (options.apple2 === 'e') {
            line += ' '; // D6F9: JSR SPCLIN
        }
        line += `${lineNo} `; // D6FC, always 1 space after line number
        offset += 2;

        // In the original ROM, the line length is checked immediately
        // after the line number is printed. For simplicity, this method
        // always assumes that there is space for one token—which would
        // have been the case on a realy Apple.
        while (this.program[offset] !== 0) {
            if (offset >= this.program.length) {
                lines.unshift('Unterminated line: ');
                break;
            }
            const token = this.program[offset];
            if (token >= 0x80 && token <= 0xea) {
                line += ' '; // D750, always put a space in front of token
                line += resolveToken(token);
                line += ' '; // D762, always put a trailing space
            } else {
                line += resolveToken(token);
            }
            offset++;

            // The Apple //e and ][+ differ in how they choose to break
            // long lines. In the ][+, D705 prints a newline if the
            // current column (MON_CH, $24) is greater than or equal to
            // 33. In the //e, control is passed to GETCH (F7B4), which
            // uses column 33 in 40-column mode and column 73 in 80-column
            // mode.
            //
            // The ][+ behaves more like a //e when there is an 80-column
            // card active (programs wrap at column 73).  From what I can
            // tell (using Virtual ]['s inspector), the 80-column card
            // keeps MON_CH at zero until the actual column is >= 71, when
            // it sets it to the actual cursor position - 40.  In the
            // Videx Videoterm ROM, this fixup happens in BASOUT (CBCD) at
            // CBE6 by getting the 80-column horizontal cursor position and
            // subtracting 0x47 (71). If the result is less than zero, then
            // 0x00 is stored in MON_CH, otherwise 31 is added back and the
            // result is stored in MON_CH. (The manual is archived at
            // http://www.apple-iigs.info/doc/fichiers/videoterm.pdf, among
            // other places.)
            //
            // For out purposes, we're just going to use the number of
            // columns - 7.
            if (line.length >= options.columns - 7) {
                line += '\n';
                lines.push(line);
                line = '     ';
            }
        }
        lines.push(line + '\n');
        return lines.join('');
    }

    /**
     * Lists the program in the same format that an Apple II prints to the
     * screen.
     *
     * This method also accepts a starting and ending line number. Like on
     * an Apple II, this will print all of the lines between `from` and `to`
     * (inclusive) regardless of the actual line numbers between them.
     *
     * To list a single line, pass the same number for both `from` and `to`.
     *
     * @param options The options for formatting the output.
     * @param from The first line to print (default 0).
     * @param to The last line to print (default end of program).
     */
    list(options: Partial<ListOptions> = {},
        from: number = 0, to: number = 65536): string {
        const allOptions = { ...DEFAULT_LIST_OPTIONS, ...options };

        let result = '';
        this.forEachLine(from, to, offset => {
            result += this.listLine(offset, allOptions);
        });
        return result;
    }

    /**
     * Returns a single line for the given compiled line in as little
     * space as possible.
     */
    compactLine(offset: word): string {
        let result = '';
        let spaceIf: (nextToken: string) => boolean = () => false;

        const lineNo = this.wordAt(offset);
        result += lineNo;
        spaceIf = (nextToken: string) => /^\d/.test(nextToken);
        offset += 2;

        while (this.program[offset] !== 0) {
            if (offset >= this.program.length) {
                return 'Unterminated line: ' + result;
            }
            const token = this.program[offset];
            let tokenString = resolveToken(token);
            if (tokenString === 'PRINT') {
                tokenString = '?';
            }
            if (spaceIf(tokenString)) {
                result += ' ';
            }

            result += tokenString;

            spaceIf = () => false;
            if (token === STRING_TO_TOKEN['AT']) {
                spaceIf = (nextToken) => nextToken.toUpperCase().startsWith('N');
            }

            offset++;
        }
        return result;
    }

    /**
     * Returns a single line for the compiled line, but with even spacing:
     *   * space after line number (not before)
     *   * space before and after colons (`:`)
     *   * space around equality and assignment operators (`=`, `<=`, etc.)
     *   * space after tokens, unless it looks like a function call
     *   * space after commas, but not before
     */
    prettyLine(offset: word): string {
        let result = '';
        let inString = false;
        let spaceIf: (char: byte) => boolean = () => false;

        const lineNo = this.wordAt(offset);
        result += `${lineNo} `;
        offset += 2;

        while (this.program[offset] !== 0) {
            if (offset >= this.program.length) {
                return 'Unterminated line: ' + result;
            }
            const token = this.program[offset];
            const tokenString = resolveToken(token);
            if (tokenString === '"') {
                inString = !inString;
            }

            if (spaceIf(token) || (!inString && tokenString === ':')) {
                result += ' ';
            }

            result += tokenString;

            if (!inString && tokenString === ':') {
                spaceIf = () => true;
            } else if (!inString && tokenString === ',') {
                spaceIf = () => true;
            } else if (token >= 0xcf && token <= 0xd1) {
                // For '<', '=', '>', don't add a space between them.
                spaceIf = (token: byte) => token < 0xcf || token > 0xd1;
            } else if (token > 0x80 && token < 0xea) {
                // By default, if a token is followed by an open paren, don't
                // add a space.
                spaceIf = (token: byte) => token !== 0x28;
            } else {
                // By default, if a literal is followed by a token, add a space.
                spaceIf = (token: byte) => token >= 0x80 && token <= 0xea;
            }

            offset++;
        }
        return result;
    }

    /**
     * Decompiles the program based on the given options.
     */
    decompile(options: Partial<DecompileOptions> = {},
        from: number = 0, to: number = 65536): string {
        const allOptions = { ...DEFAULT_DECOMPILE_OPTIONS, ...options };

        const results: string[] = [];
        this.forEachLine(from, to, offset => {
            results.push(allOptions.style === 'compact' ? this.compactLine(offset) : this.prettyLine(offset));
        });
        return results.join('\n');
    }
}
