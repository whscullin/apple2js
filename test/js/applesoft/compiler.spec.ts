import ApplesoftCompiler from 'js/applesoft/compiler';
import RAM from 'js/ram';
import { Memory } from 'js/types';

// Zero page locations used by Applesoft. The names come from
// the commented decompilation produced by the Merlin Pro
// assembler, revision 4/27/84. There is evidence from
// https://www.pagetable.com/?p=774 that the original Microsoft
// BASIC source code used these names as well.
const TXTTAB = 0x67; // start of program, word
const VARTAB = 0x69; // start of variables, word
const ARYTAB = 0x6b; // start of arrays, word
const STREND = 0x6d; // end of strings, word
const PRGEND = 0xaf; // end of program, word

function compileToMemory(ram: Memory, program: string) {
    ApplesoftCompiler.compileToMemory(ram, program);
}

// Manual decompilation based on "Applesoft Internal Structure"
// by C.K. Mesztenyi/Washington Apple Pi, from Call—A.P.P.L.E.,
// January, 1982. Archived at:
// https://archive.org/details/DTCA2DOC-045_applesoft_internal
// Decompilation verified on the emulator by typing in the
// program, then:
//    ]CALL -151
//    *800.820
// and comparing the resulting bytes (starting at 801).

describe('ApplesoftCompiler', () => {
    it('compiles a one-line hello world', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10 PRINT "HELLO, WORLD!"');
        expect(compiler.program()).toEqual(
            new Uint8Array([
                0x16, 0x08, 0x0a, 0x00, 0xba, 0x22, 0x48, 0x45, 0x4c, 0x4c,
                0x4f, 0x2c, 0x20, 0x57, 0x4f, 0x52, 0x4c, 0x44, 0x21, 0x22,
                0x00, 0x00, 0x00,
            ])
        );
    });

    it('compiles a one-line hello world into memory', () => {
        const ram = new RAM(0, 0xff); // 64K of RAM

        compileToMemory(ram, '10 PRINT "HELLO, WORLD!"');
        expect(ram.read(0x08, 0x01)).toBe(0x16); // pointer to next line low
        expect(ram.read(0x08, 0x02)).toBe(0x08); // pointer to next line high
        expect(ram.read(0x08, 0x03)).toBe(10); // line number low
        expect(ram.read(0x08, 0x04)).toBe(0); // line number high
        expect(ram.read(0x08, 0x05)).toBe(0xba); // PRINT
        expect(ram.read(0x08, 0x06)).toBe(0x22); // "
        expect(ram.read(0x08, 0x07)).toBe(0x48); // H
        expect(ram.read(0x08, 0x08)).toBe(0x45); // E
        expect(ram.read(0x08, 0x09)).toBe(0x4c); // L
        expect(ram.read(0x08, 0x0a)).toBe(0x4c); // L
        expect(ram.read(0x08, 0x0b)).toBe(0x4f); // O
        expect(ram.read(0x08, 0x0c)).toBe(0x2c); // ,
        expect(ram.read(0x08, 0x0d)).toBe(0x20); // space
        expect(ram.read(0x08, 0x0e)).toBe(0x57); // W
        expect(ram.read(0x08, 0x0f)).toBe(0x4f); // O
        expect(ram.read(0x08, 0x10)).toBe(0x52); // R
        expect(ram.read(0x08, 0x11)).toBe(0x4c); // L
        expect(ram.read(0x08, 0x12)).toBe(0x44); // D
        expect(ram.read(0x08, 0x13)).toBe(0x21); // !
        expect(ram.read(0x08, 0x14)).toBe(0x22); // "
        expect(ram.read(0x08, 0x15)).toBe(0x00); // end of line
        expect(ram.read(0x08, 0x16)).toBe(0x00); // end of program low
        expect(ram.read(0x08, 0x17)).toBe(0x00); // end of program high

        expect(ram.read(0x00, TXTTAB)).toBe(0x01); // start of program low
        expect(ram.read(0x00, TXTTAB + 1)).toBe(0x08); // start of program high
        expect(ram.read(0x00, VARTAB)).toBe(0x19); // start of variables low
        expect(ram.read(0x00, VARTAB + 1)).toBe(0x08); // start of variables high
        expect(ram.read(0x00, ARYTAB)).toBe(0x19); // start of arrays low
        expect(ram.read(0x00, ARYTAB + 1)).toBe(0x08); // start of arrays high
        expect(ram.read(0x00, STREND)).toBe(0x19); // end of strings low
        expect(ram.read(0x00, STREND + 1)).toBe(0x08); // end of strings high
        expect(ram.read(0x00, PRGEND)).toBe(0x19); // end of program low
        expect(ram.read(0x00, PRGEND + 1)).toBe(0x08); // end of program high
    });

    it('uppercases normal-mode text, like variables', () => {
        const ram = new RAM(0, 0xff); // 64K of RAM

        compileToMemory(ram, '10 fori=xtoz');
        expect(ram.read(0x08, 0x03)).toBe(10); // line number low
        expect(ram.read(0x08, 0x04)).toBe(0); // line number high
        expect(ram.read(0x08, 0x05)).toBe(0x81); // FOR
        expect(ram.read(0x08, 0x06)).toBe(0x49); // I
        expect(ram.read(0x08, 0x07)).toBe(0xd0); // = (token)
        expect(ram.read(0x08, 0x08)).toBe(0x58); // X
        expect(ram.read(0x08, 0x09)).toBe(0xc1); // TO
        expect(ram.read(0x08, 0x0a)).toBe(0x5a); // Z
        expect(ram.read(0x08, 0x0b)).toBe(0x00); // end of line
    });

    it('allows lower-case characters in strings', () => {
        const ram = new RAM(0, 0xff); // 64K of RAM

        compileToMemory(ram, '10 PRINT "Hello!"');
        expect(ram.read(0x08, 0x03)).toBe(10); // line number low
        expect(ram.read(0x08, 0x04)).toBe(0); // line number high
        expect(ram.read(0x08, 0x05)).toBe(0xba); // PRINT
        expect(ram.read(0x08, 0x06)).toBe(0x22); // "
        expect(ram.read(0x08, 0x07)).toBe(0x48); // H
        expect(ram.read(0x08, 0x08)).toBe(0x65); // e
        expect(ram.read(0x08, 0x09)).toBe(0x6c); // l
        expect(ram.read(0x08, 0x0a)).toBe(0x6c); // l
        expect(ram.read(0x08, 0x0b)).toBe(0x6f); // o
    });

    it('allows lower-case characters in comments', () => {
        const ram = new RAM(0, 0xff); // 64K of RAM

        compileToMemory(ram, '10 REM Hello!');
        expect(ram.read(0x08, 0x03)).toBe(10); // line number low
        expect(ram.read(0x08, 0x04)).toBe(0); // line number high
        expect(ram.read(0x08, 0x05)).toBe(0xb2); // REM
        expect(ram.read(0x08, 0x06)).toBe(0x20); // space
        expect(ram.read(0x08, 0x07)).toBe(0x48); // H
        expect(ram.read(0x08, 0x08)).toBe(0x65); // e
        expect(ram.read(0x08, 0x09)).toBe(0x6c); // l
        expect(ram.read(0x08, 0x0a)).toBe(0x6c); // l
        expect(ram.read(0x08, 0x0b)).toBe(0x6f); // o
    });

    it('allows lower-case tokens', () => {
        const ram = new RAM(0, 0xff); // 64K of RAM

        compileToMemory(ram, '10 print "Hello!"');
        expect(ram.read(0x08, 0x03)).toBe(10); // line number low
        expect(ram.read(0x08, 0x04)).toBe(0); // line number high
        expect(ram.read(0x08, 0x05)).toBe(0xba); // PRINT
    });

    it('accepts out-of-order lines', () => {
        const ram = new RAM(0, 0xff); // 64K of RAM

        compileToMemory(ram, '20 GOTO 10\n10 PRINT "HELLO');
        expect(ram.read(0x08, 0x01)).toBe(0x0d); // pointer to next line low
        expect(ram.read(0x08, 0x02)).toBe(0x08); // pointer to next line high
        expect(ram.read(0x08, 0x03)).toBe(10); // line number low
        expect(ram.read(0x08, 0x04)).toBe(0); // line number high
        expect(ram.read(0x08, 0x05)).toBe(0xba); // PRINT
        expect(ram.read(0x08, 0x06)).toBe(0x22); // "
        expect(ram.read(0x08, 0x07)).toBe(0x48); // H
        expect(ram.read(0x08, 0x08)).toBe(0x45); // E
        expect(ram.read(0x08, 0x09)).toBe(0x4c); // L
        expect(ram.read(0x08, 0x0a)).toBe(0x4c); // L
        expect(ram.read(0x08, 0x0b)).toBe(0x4f); // O
        expect(ram.read(0x08, 0x0c)).toBe(0x00); // end of line
        expect(ram.read(0x08, 0x0d)).toBe(0x15); // pointer to next line low
        expect(ram.read(0x08, 0x0e)).toBe(0x08); // pointer to next line high
        expect(ram.read(0x08, 0x0f)).toBe(0x14); // line number low
        expect(ram.read(0x08, 0x10)).toBe(0x00); // line number high
        expect(ram.read(0x08, 0x11)).toBe(0xab); // GOTO
        expect(ram.read(0x08, 0x12)).toBe(0x31); // 1
        expect(ram.read(0x08, 0x13)).toBe(0x30); // 0
        expect(ram.read(0x08, 0x14)).toBe(0x00); // end of line
        expect(ram.read(0x08, 0x15)).toBe(0x00); // end of program low
        expect(ram.read(0x08, 0x16)).toBe(0x00); // end of program high
    });

    it('prefers ATN to AT', () => {
        const ram = new RAM(0, 0xff); // 64K of RAM

        compileToMemory(ram, '10 X = ATN(20)');
        expect(ram.read(0x08, 0x03)).toBe(10); // line number low
        expect(ram.read(0x08, 0x04)).toBe(0); // line number high
        expect(ram.read(0x08, 0x05)).toBe(0x58); // X
        expect(ram.read(0x08, 0x06)).toBe(0xd0); // = (token)
        expect(ram.read(0x08, 0x07)).toBe(0xe1); // ATN
        expect(ram.read(0x08, 0x08)).toBe(0x28); // (
        expect(ram.read(0x08, 0x09)).toBe(0x32); // 2
        expect(ram.read(0x08, 0x0a)).toBe(0x30); // 0
        expect(ram.read(0x08, 0x0b)).toBe(0x29); // )
        expect(ram.read(0x08, 0x0c)).toBe(0x00); // end of line
    });

    it('prefers TO to AT', () => {
        const ram = new RAM(0, 0xff); // 64K of RAM

        compileToMemory(ram, '10 FORI=ATOZ');
        expect(ram.read(0x08, 0x03)).toBe(10); // line number low
        expect(ram.read(0x08, 0x04)).toBe(0); // line number high
        expect(ram.read(0x08, 0x05)).toBe(0x81); // FOR
        expect(ram.read(0x08, 0x06)).toBe(0x49); // I
        expect(ram.read(0x08, 0x07)).toBe(0xd0); // = (token)
        expect(ram.read(0x08, 0x08)).toBe(0x41); // A
        expect(ram.read(0x08, 0x09)).toBe(0xc1); // TO
        expect(ram.read(0x08, 0x0a)).toBe(0x5a); // Z
        expect(ram.read(0x08, 0x0b)).toBe(0x00); // end of line
    });

    it('parses DATA statements that start with space', () => {
        const ram = new RAM(0, 0xff); // 64K of RAM

        compileToMemory(ram, '10 DATA 1,2,3');
        expect(ram.read(0x08, 0x03)).toBe(10); // line number low
        expect(ram.read(0x08, 0x04)).toBe(0); // line number high
        expect(ram.read(0x08, 0x05)).toBe(0x83); // DATA
        expect(ram.read(0x08, 0x06)).toBe(0x20); // space
        expect(ram.read(0x08, 0x07)).toBe(0x31); // 1
        expect(ram.read(0x08, 0x08)).toBe(0x2c); // ,
        expect(ram.read(0x08, 0x09)).toBe(0x32); // 2
        expect(ram.read(0x08, 0x0a)).toBe(0x2c); // ,
        expect(ram.read(0x08, 0x0b)).toBe(0x33); // 3
        expect(ram.read(0x08, 0x0c)).toBe(0x00); // end of line
    });

    it('parses DATA statements with numbers', () => {
        const ram = new RAM(0, 0xff); // 64K of RAM

        compileToMemory(ram, '10 DATA1,2,3');
        expect(ram.read(0x08, 0x03)).toBe(10); // line number low
        expect(ram.read(0x08, 0x04)).toBe(0); // line number high
        expect(ram.read(0x08, 0x05)).toBe(0x83); // DATA
        expect(ram.read(0x08, 0x06)).toBe(0x31); // 1
        expect(ram.read(0x08, 0x07)).toBe(0x2c); // ,
        expect(ram.read(0x08, 0x08)).toBe(0x32); // 2
        expect(ram.read(0x08, 0x09)).toBe(0x2c); // ,
        expect(ram.read(0x08, 0x0a)).toBe(0x33); // 3
        expect(ram.read(0x08, 0x0b)).toBe(0x00); // end of line
    });

    it('parses DATA statements with strings including lower-case', () => {
        const ram = new RAM(0, 0xff); // 64K of RAM

        compileToMemory(ram, '10 DATA"abc"');
        expect(ram.read(0x08, 0x03)).toBe(10); // line number low
        expect(ram.read(0x08, 0x04)).toBe(0); // line number high
        expect(ram.read(0x08, 0x05)).toBe(0x83); // DATA
        expect(ram.read(0x08, 0x06)).toBe(0x22); // "
        expect(ram.read(0x08, 0x07)).toBe(0x61); // a
        expect(ram.read(0x08, 0x08)).toBe(0x62); // b
        expect(ram.read(0x08, 0x09)).toBe(0x63); // c
        expect(ram.read(0x08, 0x0a)).toBe(0x22); // "
        expect(ram.read(0x08, 0x0b)).toBe(0x00); // end of line
    });

    it('parses DATA statements with literals', () => {
        const ram = new RAM(0, 0xff); // 64K of RAM

        compileToMemory(ram, '10 DATAHELLO');
        expect(ram.read(0x08, 0x03)).toBe(10); // line number low
        expect(ram.read(0x08, 0x04)).toBe(0); // line number high
        expect(ram.read(0x08, 0x05)).toBe(0x83); // DATA
        expect(ram.read(0x08, 0x06)).toBe(0x48); // H
        expect(ram.read(0x08, 0x07)).toBe(0x45); // E
        expect(ram.read(0x08, 0x08)).toBe(0x4c); // L
        expect(ram.read(0x08, 0x09)).toBe(0x4c); // L
        expect(ram.read(0x08, 0x0a)).toBe(0x4f); // O
        expect(ram.read(0x08, 0x0b)).toBe(0x00); // end of line
    });

    it('parses DATA statements with literals including lower-case', () => {
        const ram = new RAM(0, 0xff); // 64K of RAM

        compileToMemory(ram, '10 DATAHello');
        expect(ram.read(0x08, 0x03)).toBe(10); // line number low
        expect(ram.read(0x08, 0x04)).toBe(0); // line number high
        expect(ram.read(0x08, 0x05)).toBe(0x83); // DATA
        expect(ram.read(0x08, 0x06)).toBe(0x48); // H
        expect(ram.read(0x08, 0x07)).toBe(0x65); // e
        expect(ram.read(0x08, 0x08)).toBe(0x6c); // l
        expect(ram.read(0x08, 0x09)).toBe(0x6c); // l
        expect(ram.read(0x08, 0x0a)).toBe(0x6f); // o
        expect(ram.read(0x08, 0x0b)).toBe(0x00); // end of line
    });

    it('parses DATA statements with literals including quotes', () => {
        const ram = new RAM(0, 0xff); // 64K of RAM

        compileToMemory(ram, '10 DATAAA"B');
        expect(ram.read(0x08, 0x03)).toBe(10); // line number low
        expect(ram.read(0x08, 0x04)).toBe(0); // line number high
        expect(ram.read(0x08, 0x05)).toBe(0x83); // DATA
        expect(ram.read(0x08, 0x06)).toBe(0x41); // A
        expect(ram.read(0x08, 0x07)).toBe(0x41); // A
        expect(ram.read(0x08, 0x08)).toBe(0x22); // "
        expect(ram.read(0x08, 0x09)).toBe(0x42); // B
        expect(ram.read(0x08, 0x0a)).toBe(0x00); // end of line
    });

    it('parses DATA statements with literals including spaces', () => {
        const ram = new RAM(0, 0xff); // 64K of RAM

        compileToMemory(ram, '10 DATAA  B');
        expect(ram.read(0x08, 0x03)).toBe(10); // line number low
        expect(ram.read(0x08, 0x04)).toBe(0); // line number high
        expect(ram.read(0x08, 0x05)).toBe(0x83); // DATA
        expect(ram.read(0x08, 0x06)).toBe(0x41); // A
        expect(ram.read(0x08, 0x07)).toBe(0x20); // space
        expect(ram.read(0x08, 0x08)).toBe(0x20); // space
        expect(ram.read(0x08, 0x09)).toBe(0x42); // B
        expect(ram.read(0x08, 0x0a)).toBe(0x00); // end of line
    });

    it('terminates DATA statements at colons', () => {
        const ram = new RAM(0, 0xff); // 64K of RAM

        compileToMemory(ram, '10 DATAAA:FORI=1TO1');
        expect(ram.read(0x08, 0x03)).toBe(10); // line number low
        expect(ram.read(0x08, 0x04)).toBe(0); // line number high
        expect(ram.read(0x08, 0x05)).toBe(0x83); // DATA
        expect(ram.read(0x08, 0x06)).toBe(0x41); // A
        expect(ram.read(0x08, 0x07)).toBe(0x41); // A
        expect(ram.read(0x08, 0x08)).toBe(0x3a); // :
        expect(ram.read(0x08, 0x09)).toBe(0x81); // FOR
        expect(ram.read(0x08, 0x0a)).toBe(0x49); // I
        expect(ram.read(0x08, 0x0b)).toBe(0xd0); // = (token)
        expect(ram.read(0x08, 0x0c)).toBe(0x31); // 1
        expect(ram.read(0x08, 0x0d)).toBe(0xc1); // TO
        expect(ram.read(0x08, 0x0e)).toBe(0x31); // 1
        expect(ram.read(0x08, 0x0f)).toBe(0x00); // end of line
    });

    it('does not terminate DATA statements with a literal with a quote at colon', () => {
        const ram = new RAM(0, 0xff); // 64K of RAM

        compileToMemory(ram, '10 DATAA":FORI=1TO1');
        expect(ram.read(0x08, 0x03)).toBe(10); // line number low
        expect(ram.read(0x08, 0x04)).toBe(0); // line number high
        expect(ram.read(0x08, 0x05)).toBe(0x83); // DATA
        expect(ram.read(0x08, 0x06)).toBe(0x41); // A
        expect(ram.read(0x08, 0x07)).toBe(0x22); // "
        expect(ram.read(0x08, 0x08)).toBe(0x3a); // :
        expect(ram.read(0x08, 0x09)).toBe(0x46); // F
        expect(ram.read(0x08, 0x0a)).toBe(0x4f); // O
        expect(ram.read(0x08, 0x0b)).toBe(0x52); // R
        expect(ram.read(0x08, 0x0c)).toBe(0x49); // I
        expect(ram.read(0x08, 0x0d)).toBe(0x3d); // =
        expect(ram.read(0x08, 0x0e)).toBe(0x31); // 1
        expect(ram.read(0x08, 0x0f)).toBe(0x54); // T
        expect(ram.read(0x08, 0x10)).toBe(0x4f); // O
        expect(ram.read(0x08, 0x11)).toBe(0x31); // 1
        expect(ram.read(0x08, 0x12)).toBe(0x00); // end of line
    });

    it('does terminate DATA statements with a literal with two quotes at colon', () => {
        const ram = new RAM(0, 0xff); // 64K of RAM

        compileToMemory(ram, '10 DATAA"":FORI=1TO1');
        expect(ram.read(0x08, 0x03)).toBe(10); // line number low
        expect(ram.read(0x08, 0x04)).toBe(0); // line number high
        expect(ram.read(0x08, 0x05)).toBe(0x83); // DATA
        expect(ram.read(0x08, 0x06)).toBe(0x41); // A
        expect(ram.read(0x08, 0x07)).toBe(0x22); // "
        expect(ram.read(0x08, 0x08)).toBe(0x22); // "
        expect(ram.read(0x08, 0x09)).toBe(0x3a); // :
        expect(ram.read(0x08, 0x0a)).toBe(0x81); // FOR
        expect(ram.read(0x08, 0x0b)).toBe(0x49); // I
        expect(ram.read(0x08, 0x0c)).toBe(0xd0); // = (token)
        expect(ram.read(0x08, 0x0d)).toBe(0x31); // 1
        expect(ram.read(0x08, 0x0e)).toBe(0xc1); // TO
        expect(ram.read(0x08, 0x0f)).toBe(0x31); // 1
        expect(ram.read(0x08, 0x10)).toBe(0x00); // end of line
    });

    it('does not require a space after line number', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10PRINT"HELLO, WORLD!"');
        expect(compiler.program()).toEqual(
            new Uint8Array([
                0x16, 0x08, 0x0a, 0x00, 0xba, 0x22, 0x48, 0x45, 0x4c, 0x4c,
                0x4f, 0x2c, 0x20, 0x57, 0x4f, 0x52, 0x4c, 0x44, 0x21, 0x22,
                0x00, 0x00, 0x00,
            ])
        );
    });

    it('parses ? as PRINT', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10 ?"HELLO, WORLD!"');
        expect(compiler.program()).toEqual(
            new Uint8Array([
                0x16, 0x08, 0x0a, 0x00, 0xba, 0x22, 0x48, 0x45, 0x4c, 0x4c,
                0x4f, 0x2c, 0x20, 0x57, 0x4f, 0x52, 0x4c, 0x44, 0x21, 0x22,
                0x00, 0x00, 0x00,
            ])
        );
    });

    it('skips spaces when reading tokens', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10 T H E N');
        expect(compiler.program()).toEqual(
            new Uint8Array([0x07, 0x08, 0x0a, 0x00, 0xc4, 0x00, 0x00, 0x00])
        );
    });

    it('skips spaces and ignores case when reading tokens', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10 T h E n');
        expect(compiler.program()).toEqual(
            new Uint8Array([0x07, 0x08, 0x0a, 0x00, 0xc4, 0x00, 0x00, 0x00])
        );
    });

    it('smashes tokens together', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10 NOT RACE A THEN B');
        expect(compiler.program()).toEqual(
            new Uint8Array([
                0x0c, 0x08, 0x0a, 0x00, 0x9c, 0xc5, 0x48, 0x45, 0x4e, 0x42,
                0x00, 0x00, 0x00,
            ])
        );
    });

    it('parses 10ATOZ correctly', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10ATOZ');
        expect(compiler.program()).toEqual(
            new Uint8Array([
                0x09, 0x08, 0x0a, 0x00, 0x41, 0xc1, 0x5a, 0x00, 0x00, 0x00,
            ])
        );
    });

    it('parses a bunch of crazy correctly', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile(
            [
                '10 A THEN B',
                '30 A TO Z',
                '40 AT N',
                '50 A TN',
                '60 N O T R A C E',
                '70 NOT RACE',
            ].join('\n')
        );
        expect(compiler.program()).toEqual(
            new Uint8Array([
                0x0b, 0x08, 0x0a, 0x00, 0xc5, 0x48, 0x45, 0x4e, 0x42, 0x00,
                0x13, 0x08, 0x1e, 0x00, 0x41, 0xc1, 0x5a, 0x00, 0x1a, 0x08,
                0x28, 0x00, 0xc5, 0x4e, 0x00, 0x20, 0x08, 0x32, 0x00, 0xe1,
                0x00, 0x26, 0x08, 0x3c, 0x00, 0x9c, 0x00, 0x2c, 0x08, 0x46,
                0x00, 0x9c, 0x00, 0x00, 0x00,
            ])
        );
    });
});
