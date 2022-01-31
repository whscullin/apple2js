import { ApplesoftDecompiler } from 'js/applesoft/decompiler';
import ApplesoftCompiler from 'js/applesoft/compiler';

describe('ApplesoftDecompiler', () => {

    it('lists a one-line program', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10 PRINT "Hello, World!"');

        const decompiler = new ApplesoftDecompiler(compiler.program());
        const program = decompiler.list();
        expect(program).toEqual(' 10  PRINT "Hello, World!"\n');
    });

    it('lists a program with a long line', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10 PRINT "Hello, World!"\n'
            + '20 PRINT "Hello, again, with a much longer line this time."\n'
            + '30 REM1234567890123456789012345678901234567890');

        const decompiler = new ApplesoftDecompiler(compiler.program());
        const program = decompiler.list();
        expect(program).toEqual(' 10  PRINT "Hello, World!"\n'
            + ' 20  PRINT "Hello, again, with a \n'
            + '     much longer line this time."\n'
            + '     \n'
            + ' 30  REM 123456789012345678901234\n'
            + '     5678901234567890\n');
    });

    it('lists a program with a long line Apple ][+-style', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10 PRINT "Hello, World!"\n'
            + '20 PRINT "Hello, again, with a much longer line this time."\n'
            + '30 REM1234567890123456789012345678901234567890');

        const decompiler = new ApplesoftDecompiler(compiler.program());
        const program = decompiler.list({ apple2: 'plus' });
        expect(program).toEqual('10  PRINT "Hello, World!"\n'
            + '20  PRINT "Hello, again, with a m\n'
            + '     uch longer line this time."\n'
            + '30  REM 1234567890123456789012345\n'
            + '     678901234567890\n');
    });

    it('lists a range of lines', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10 PRINT "Hello, World!"\n'
            + '20 PRINT "Hello, again, with a much longer line this time."\n'
            + '30 REM1234567890123456789012345678901234567890');

        const decompiler = new ApplesoftDecompiler(compiler.program());
        const program = decompiler.list({}, 10, 20);
        expect(program).toEqual(' 10  PRINT "Hello, World!"\n'
            + ' 20  PRINT "Hello, again, with a \n'
            + '     much longer line this time."\n'
            + '     \n');
    });

    it('lists weird code correctly', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10 NOT RACE A THEN B');

        const decompiler = new ApplesoftDecompiler(compiler.program());
        const program = decompiler.list();
        expect(program).toEqual(' 10  NOTRACE  AT HENB\n');
    });

    it('lists 10ATOZ correctly', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10ATOZ');

        const decompiler = new ApplesoftDecompiler(compiler.program());
        const program = decompiler.list();
        expect(program).toEqual(' 10 A TO Z\n');
    });

    it('wraps correctly in 80-column mode', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10 ?:?:?:?:?:?:?:?:?:?:?:?:?:?:?:?');

        const decompiler = new ApplesoftDecompiler(compiler.program());
        const program = decompiler.list({ columns: 80 });
        expect(program).toEqual(' 10  PRINT : PRINT : PRINT : PRINT : '
            + 'PRINT : PRINT : PRINT : PRINT : PRINT \n'
            + '     : PRINT : PRINT : PRINT : PRINT : PRINT : PRINT : '
            + 'PRINT \n');
    });

    it('decompiles compactly', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10 ?:?:?:?:?:?:?:?:?:?:?:?:?:?:?:?');

        const decompiler = new ApplesoftDecompiler(compiler.program());
        const program = decompiler.decompile({ style: 'compact' });
        expect(program).toEqual('10?:?:?:?:?:?:?:?:?:?:?:?:?:?:?:?');
    });

    it('when decompiling compactly, adds a space after the line', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10 12345');

        const decompiler = new ApplesoftDecompiler(compiler.program());
        const program = decompiler.decompile({ style: 'compact' });
        expect(program).toEqual('10 12345');
    });

    it('when decompiling compactly, adds a space after AT for token', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10 AT NEXT');

        const decompiler = new ApplesoftDecompiler(compiler.program());
        const program = decompiler.decompile({ style: 'compact' });
        expect(program).toEqual('10AT NEXT');
    });

    it('when decompiling compactly, adds a space after AT for literal', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10 AT n');

        const decompiler = new ApplesoftDecompiler(compiler.program());
        const program = decompiler.decompile({ style: 'compact' });
        expect(program).toEqual('10AT N');
    });

    it('when decompiling compactly, decompiles 10ATOZ correctly', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10ATOZ');

        const decompiler = new ApplesoftDecompiler(compiler.program());
        const program = decompiler.decompile({ style: 'compact' });
        expect(program).toEqual('10ATOZ');
    });

    it('when decompiling compactly, adds a space to disambiguate tokens', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile([
            '10 A THEN B',
            '30 A TO Z',
            '40 AT N',
            '50 A TN',
            '60 N O T R A C E',
            '70 NOT RACE'].join('\n'));

        const decompiler = new ApplesoftDecompiler(compiler.program());
        const program = decompiler.decompile({ style: 'compact' });
        expect(program).toEqual([
            '10ATHENB',
            '30ATOZ',
            '40AT N',
            '50ATN',
            '60NOTRACE',
            '70NOTRACE'].join('\n'));
    });

    it('when decompiling prettily, formats reasonably well', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10 FORI=1TO10:PRINTI:NEXT');

        const decompiler = new ApplesoftDecompiler(compiler.program());
        const program = decompiler.decompile({ style: 'pretty' });
        expect(program).toEqual('10 FOR I = 1 TO 10 : PRINT I : NEXT');
    });

    it('when decompiling prettily, formats relations', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10 IFA<BORA>=BORB<=AORB=A THEN');

        const decompiler = new ApplesoftDecompiler(compiler.program());
        const program = decompiler.decompile({ style: 'pretty' });
        expect(program).toEqual('10 IF A < B OR A >= B OR B <= A OR B = AT HEN');
    });

    it('when decompiling prettily, decompiles 10ATOZ correctly', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10ATOZ');

        const decompiler = new ApplesoftDecompiler(compiler.program());
        const program = decompiler.decompile({ style: 'pretty' });
        expect(program).toEqual('10 A TO Z');
    });

    it('when decompiling prettily, does not insert extra spaces in strings', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10A="::::":B=","');

        const decompiler = new ApplesoftDecompiler(compiler.program());
        const program = decompiler.decompile({ style: 'pretty' });
        expect(program).toEqual('10 A = "::::" : B = ","');
    })

    it('when decompiling prettily, inserts space after comma', () => {
        const compiler = new ApplesoftCompiler();
        compiler.compile('10 HPLOTX,Y:GOTO10');

        const decompiler = new ApplesoftDecompiler(compiler.program());
        const program = decompiler.decompile({ style: 'pretty' });
        expect(program).toEqual('10 HPLOT X, Y : GOTO 10');
    })
});