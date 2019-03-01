/*
 * Copyright 2010-2019 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

import { debug, toHex } from './util';

export default function CPU6502(options)
{
    'use strict';

    options = options || {};

    var is65C02 = options['65C02'] ? true : false;

    /* Registers */
    var pc = 0, // Program Counter
        sr = 0x20, // Process Status Register
        ar = 0, // Accumulator
        xr = 0, // X Register
        yr = 0, // Y Register
        sp = 0xff; // Stack Pointer

    /* Addressing Mode */
    var modes = {
        accumulator: 0,           // A (Accumulator)
        implied:     1,           // Implied
        immediate:   2,           // # Immediate
        absolute:    3,           // a Absolute
        zeroPage:    4,           // zp Zero Page
        relative:    5,           // r Relative

        absoluteX:   6,           // a,X Absolute, X
        absoluteY:   7,           // a,Y Absolute, Y
        zeroPageX:   8,           // zp,X Zero Page, X
        zeroPageY:   9,           // zp,Y Zero Page, Y

        absoluteIndirect:   10,  // (a) Indirect
        zeroPageXIndirect:  11, // (zp,X) Zero Page Indexed Indirect
        zeroPageIndirectY:  12, // (zp),Y Zero Page Indexed with Y

        /* 65c02 */
        zeroPageIndirect:   13,  // (zp),
        absoluteXIndirect:  14,  // (a, X),
        zeroPage_relative:  15   // zp, Relative
    };

    var sizes = {
        0 /* modes.accumulator */: 1,
        1 /* modes.implied */: 1,
        2 /* modes.immediate */: 2,
        3 /* modes.absolute */: 3,
        4 /* modes.zeroPage */: 2,
        5 /* modes.relative */: 2,
        6 /* modes.absoluteX */: 3,
        7 /* modes.absoluteY */: 3,
        8 /* modes.zeroPageX */: 2,
        9 /* modes.zeroPageY */: 2,
        10 /* modes.indirect */: 3,
        11 /* modes.zeroPageXIndirect */: 2,
        12 /* modes.zeroPageYIndirect */: 2,

        13 /* mode.zeroPageIndirect */: 2,
        14 /* mode.absoluteXIndirect */: 3,
        15 /* mode.zeroPage_relative */: 3
    };

    /* Flags */
    var flags = {
        N: 0x80, // Negative
        V: 0x40, // oVerflow
        B: 0x10, // Break
        D: 0x08, // Decimal
        I: 0x04, // Interrupt
        Z: 0x02, // Zero
        C: 0x01  // Carry
    };

    /* Memory Locations */
    var loc = {
        STACK: 0x100,
        NMI: 0xFFFA,
        RESET: 0xFFFC,
        BRK: 0xFFFE
    };

    var idx;

    var readPages = [];
    var writePages = [];
    var resetHandlers = [];
    var inCallback = false;
    var cycles = 0;
    var sync = false;

    var blankPage = {
        read: function() { return 0; },
        write: function() {}
    };

    for (idx = 0; idx < 0x100; idx++) {
        readPages[idx] = blankPage;
        writePages[idx] = blankPage;
    }

    function setFlag(f, on) {
        sr = on ? (sr | f) : (sr & ~f);
    }

    function testNZ(val) {
        sr = val === 0 ? (sr | flags.Z) : (sr & ~flags.Z);
        sr = (val & 0x80) ? (sr | flags.N) : (sr & ~flags.N);

        return val;
    }

    function testZ(val) {
        sr = val === 0 ? (sr | flags.Z) : (sr & ~flags.Z);

        return val;
    }

    function add(a, b, sub) {
        if (sub)
            b ^= 0xff;

        // KEGS
        var c, v;
        if ((sr & flags.D) !== 0) {
            c = (a & 0x0f) + (b & 0x0f) + (sr & flags.C);
            if (sub) {
                if (c < 0x10)
                    c = (c - 0x06) & 0x0f;
                c += (a & 0xf0) + (b & 0xf0);
                v = (c >> 1) ^ c;
                if (c < 0x100)
                    c = (c + 0xa0) & 0xff;
            } else {
                if (c > 0x09)
                    c = (c - 0x0a) | 0x10; // carry to MSN
                c += (a & 0xf0) + (b & 0xf0);
                v = (c >> 1) ^ c;
                if (c > 0x99)
                    c += 0x60;
            }
        } else {
            c = a + b + (sr & flags.C);
            v = (c ^ a) & 0x80;
        }

        if (((a ^ b) & 0x80) !== 0) {
            v = 0;
        }

        setFlag(flags.C, c > 0xff);
        setFlag(flags.V, v);

        return testNZ(c & 0xff);
    }

    function increment(a) {
        return testNZ((a + 0x01) & 0xff);
    }

    function decrement(a) {
        return testNZ((a + 0xff) & 0xff);
    }

    function readBytePC(dbg) {
        var addr = (pc++) & 0xffff,
            page = addr >> 8,
            off = addr & 0xff;

        return readPages[page].read(page, off, dbg);
    }

    function readByte(addr, dbg) {
        var page = addr >> 8,
            off = addr & 0xff;

        return readPages[page].read(page, off, dbg);
    }

    function writeByte(addr, val) {
        var page = addr >> 8,
            off = addr & 0xff;

        writePages[page].write(page, off, val);
    }

    function readWord(addr, dbg) {
        return readByte(addr, dbg) | (readByte(addr + 1, dbg) << 8);
    }

    function readWordPC(dbg) {
        return readBytePC(dbg) | (readBytePC(dbg) << 8);
    }

    function readZPWord(addr, dbg) {
        var lsb, msb;

        lsb = readByte(addr & 0xff, dbg);
        msb = readByte((addr + 1) & 0xff, dbg);

        return (msb << 8) | lsb;
    }

    function pushByte(val) {
        writeByte(loc.STACK | sp, val);
        sp = (sp + 0xff) & 0xff;
    }

    function pushWord(val) {
        pushByte(val >> 8);
        pushByte(val & 0xff);
    }

    function pullByte() {
        sp = (sp + 0x01) & 0xff;
        return readByte(loc.STACK | sp);
    }

    function pullWord() {
        var lsb = pullByte(),
            msb = pullByte();

        return (msb << 8) | lsb;
    }

    function indirectBug(addr) {
        var page = addr & 0xff00;
        var off = addr & 0xff;
        var lsb = readByte(page | (off & 0xff));
        var msb = readByte(page | ((off + 0x01) & 0xff));

        return (msb << 8) | lsb;
    }

    /*
     * Read functions
     */

    function readImplied() {
    }

    // #$00
    function readImmediate() {
        return readBytePC();
    }

    // $0000
    function readAbsolute() {
        return readByte(readWordPC());
    }

    // $00
    function readZeroPage() {
        return readByte(readBytePC());
    }

    // $0000,X
    function readAbsoluteX() {
        var addr = readWordPC(), oldPage = addr >> 8, page;
        addr = (addr + xr) & 0xffff;
        page = addr >> 8;
        if (page != oldPage) {
            cycles++;
        }
        return readByte(addr);
    }

    // $0000,Y
    function readAbsoluteY() {
        var addr = readWordPC(), oldPage = addr >> 8, page;
        addr = (addr + yr) & 0xffff;
        page = addr >> 8;
        if (page != oldPage) {
            cycles++;
        }
        return readByte(addr);
    }

    // $00,X
    function readZeroPageX() {
        return readByte((readBytePC() + xr) & 0xff);
    }

    // $00,Y
    function readZeroPageY() {
        return readByte((readBytePC() + yr) & 0xff);
    }

    // ($00,X)
    function readZeroPageXIndirect() {
        return readByte(readZPWord((readBytePC() + xr) & 0xff));
    }

    // ($00),Y
    function readZeroPageIndirectY() {
        var addr = readZPWord(readBytePC()), oldPage = addr >> 8, page;
        addr = (addr + yr) & 0xffff;
        page = addr >> 8;
        if (page != oldPage) {
            cycles++;
        }
        return readByte(addr);
    }

    // ($00) (65C02)
    function readZeroPageIndirect() {
        return readByte(readZPWord(readBytePC()));
    }

    /*
     * Write Functions
     */

    // $0000
    function writeAbsolute(val) {
        writeByte(readWordPC(), val);
    }

    // $00
    function writeZeroPage(val) {
        writeByte(readBytePC(), val);
    }

    // $0000,X
    function writeAbsoluteX(val) {
        writeByte((readWordPC() + xr) & 0xffff, val);
    }

    // $0000,Y
    function writeAbsoluteY(val) {
        writeByte((readWordPC() + yr) & 0xffff, val);
    }

    // $00,X
    function writeZeroPageX(val) {
        writeByte((readBytePC() + xr) & 0xff, val);
    }

    // $00,Y
    function writeZeroPageY(val) {
        writeByte((readBytePC() + yr) & 0xff, val);
    }

    // ($00,X)
    function writeZeroPageXIndirect(val) {
        writeByte(readZPWord((readBytePC() + xr) & 0xff), val);
    }

    // ($00),Y
    function writeZeroPageIndirectY(val) {
        writeByte((readZPWord(readBytePC()) + yr) & 0xffff, val);
    }

    // ($00) (65C02)
    function writeZeroPageIndirect(val) {
        writeByte(readZPWord(readBytePC()), val);
    }

    // $00
    function readAddrZeroPage() {
        return readBytePC();
    }

    // $00,X
    function readAddrZeroPageX() {
        return (readBytePC() + xr) & 0xff;
    }

    // $0000 (65C02)
    function readAddrAbsolute() {
        return readWordPC();
    }

    // ($0000) (6502)
    function readAddrAbsoluteIndirectBug() {
        return indirectBug(readWordPC());
    }

    // ($0000) (65C02)
    function readAddrAbsoluteIndirect() {
        return readWord(readWordPC());
    }

    // $0000,X
    function readAddrAbsoluteX() {
        var addr = readWordPC();
        if (!is65C02) {
            readByte(addr);
        }
        return (addr + xr) & 0xffff;
    }

    // $(0000,X)
    function readAddrAbsoluteXIndirect() {
        return readWord((readWordPC() + xr) & 0xffff);
    }

    /* Break */
    function brk(readFn) {
        readFn();
        pushWord(pc);
        php();
        if (is65C02) {
            setFlag(flags.D, false);
        }
        setFlag(flags.I, true);
        pc = readWord(loc.BRK);
    }

    /* Load Accumulator */
    function lda(readFn) {
        ar = testNZ(readFn());
    }

    /* Load X Register */
    function ldx(readFn) {
        xr = testNZ(readFn());
    }

    /* Load Y Register */
    function ldy(readFn) {
        yr = testNZ(readFn());
    }

    /* Store Accumulator */
    function sta(writeFn) {
        writeFn(ar);
    }

    /* Store X Register */
    function stx(writeFn) {
        writeFn(xr);
    }

    /* Store Y Register */
    function sty(writeFn) {
        writeFn(yr);
    }

    /* Store Zero */
    function stz(writeFn) {
        writeFn(0);
    }

    /* Add with Carry */
    function adc(readFn) {
        ar = add(ar, readFn(), false);
    }

    /* Subtract with Carry */
    function sbc(readFn) {
        ar = add(ar, readFn(), true);
    }

    /* Increment Memory */
    function incA() {
        ar = increment(ar);
    }

    function inc(readAddrFn) {
        var addr = readAddrFn();
        writeByte(addr, increment(readByte(addr)));
    }

    /* Increment X */
    function inx() {
        xr = increment(xr);
    }

    /* Increment Y */
    function iny() {
        yr = increment(yr);
    }

    /* Decrement Memory */
    function decA() {
        ar = decrement(ar);
    }

    function dec(readAddrFn) {
        var addr = readAddrFn();
        writeByte(addr, decrement(readByte(addr)));
    }

    /* Decrement X */
    function dex() {
        xr = decrement(xr);
    }

    /* Decrement Y */
    function dey() {
        yr = decrement(yr);
    }

    function shiftLeft(val) {
        setFlag(flags.C, val & 0x80);
        return testNZ((val << 1) & 0xff);
    }

    /* Arithmatic Shift Left */
    function aslA() {
        ar = shiftLeft(ar);
    }

    function asl(readAddrFn) {
        var addr = readAddrFn();
        writeByte(addr, shiftLeft(readByte(addr)));
    }

    function shiftRight(val) {
        setFlag(flags.C, val & 0x01);
        return testNZ(val >> 1);
    }

    /* Logical Shift Right */
    function lsrA() {
        ar = shiftRight(ar);
    }

    function lsr(readAddrFn) {
        var addr = readAddrFn();
        writeByte(addr, shiftRight(readByte(addr)));
    }

    function rotateLeft(val) {
        var c = (sr & flags.C);
        setFlag(flags.C, val & 0x80);
        return testNZ(((val << 1) | (c ? 0x01 : 0x00)) & 0xff);
    }

    /* Rotate Left */
    function rolA() {
        ar = rotateLeft(ar);
    }

    function rol(readAddrFn) {
        var addr = readAddrFn();
        writeByte(addr, rotateLeft(readByte(addr)));
    }

    function rotateRight(a) {
        var c = (sr & flags.C);
        setFlag(flags.C, a & 0x01);
        return testNZ((a >> 1) | (c ? 0x80 : 0x00));
    }

    /* Rotate Right */
    function rorA() {
        ar = rotateRight(ar);
    }

    function ror(readAddrFn) {
        var addr = readAddrFn();
        writeByte(addr, rotateRight(readByte(addr)));
    }

    /* Logical And Accumulator */
    function and(readFn) {
        ar = testNZ(ar & readFn());
    }

    /* Logical Or Accumulator */
    function ora(readFn) {
        ar = testNZ(ar | readFn());
    }

    /* Logical Exclusive Or Accumulator */
    function eor(readFn) {
        ar = testNZ(ar ^ readFn());
    }

    /* Reset Bit */

    function rmb(b) {
        var bit = (0x1 << b) ^ 0xFF;
        var addr = readBytePC();
        var val = readByte(addr);
        val &= bit;
        writeByte(addr, val);
    }

    /* Set Bit */

    function smb(b) {
        var bit = 0x1 << b;
        var addr = readBytePC();
        var val = readByte(addr);
        val |= bit;
        writeByte(addr, val);
    }

    /* Test and Reset Bits */
    function trb(readAddrFn) {
        var addr = readAddrFn(),
            val = readByte(addr);
        testZ(val & ar);
        writeByte(addr, val & ~ar);
    }

    /* Test and Set Bits */
    function tsb(readAddrFn) {
        var addr = readAddrFn(),
            val = readByte(addr);
        testZ(val & ar);
        writeByte(addr, val | ar);
    }

    /* Bit */
    function bit(readFn) {
        var val = readFn();
        setFlag(flags.Z, (val & ar) === 0);
        setFlag(flags.N, val & 0x80);
        setFlag(flags.V, val & 0x40);
    }

    /* Bit Immediate*/
    function bitI(readFn) {
        var val = readFn();
        setFlag(flags.Z, (val & ar) === 0);
    }

    function compare(a, b)
    {
        b = (b ^ 0xff);
        var c = a + b + 1;
        setFlag(flags.C, c > 0xff);
        testNZ(c & 0xff);
    }

    function cmp(readFn) {
        compare(ar, readFn());
    }

    function cpx(readFn) {
        compare(xr, readFn());
    }

    function cpy(readFn) {
        compare(yr, readFn());
    }

    /* Branches */
    function brs(f) {
        var off = readBytePC(); // changes pc
        if ((f & sr) !== 0) {
            var oldPC = pc;
            pc += off > 127 ? off - 256 : off;
            cycles++;
            if ((pc >> 8) != (oldPC >> 8)) cycles++;
        }
    }

    function brc(f) {
        var off = readBytePC(); // changes pc
        if ((f & sr) === 0) {
            var oldPC = pc;
            pc += off > 127 ? off - 256 : off;
            cycles++;
            if ((pc >> 8) != (oldPC >> 8)) cycles++;
        }
    }

    /* WDC 65C02 branches */

    function bbr(b) {
        var val = readZeroPage();
        var off = readBytePC(); // changes pc
        if (((1 << b) & val) === 0) {
            pc += off > 127 ? off - 256 : off;
        }
    }

    function bbs(b) {
        var val = readZeroPage(); // ZP
        var off = readBytePC(); // changes pc
        if (((1 << b) & val) !== 0) {
            pc += off > 127 ? off - 256 : off;
        }
    }

    /* Transfers and stack */
    function tax() { testNZ(xr = ar); }

    function txa() { testNZ(ar = xr); }

    function tay() { testNZ(yr = ar); }

    function tya() { testNZ(ar = yr); }

    function tsx() { testNZ(xr = sp); }

    function txs() { sp = xr; }

    function pha() { pushByte(ar); }

    function pla() { testNZ(ar = pullByte()); }

    function phx() { pushByte(xr); }

    function plx() { testNZ(xr = pullByte()); }

    function phy() { pushByte(yr); }

    function ply() { testNZ(yr = pullByte()); }

    function php() { pushByte(sr | flags.B); }

    function plp() { sr = (pullByte() & ~flags.B) | 0x20; }

    /* Jump */
    function jmp(readAddrFn) {
        pc = readAddrFn();
    }

    /* Jump Subroutine */
    function jsr(readAddrFn) {
        var dest = readAddrFn();
        pushWord(pc - 1);
        pc = dest;
    }

    /* Return from Subroutine */
    function rts() {
        pc = (pullWord() + 1) & 0xffff;
    }

    /* Return from Subroutine */
    function rti() {
        sr = pullByte() & ~flags.B;
        pc = pullWord();
    }

    /* Set and Clear */
    function set(flag) {
        sr |= flag;
    }

    function clr(flag) {
        sr &= ~flag;
    }

    /* No-Op */
    function nop(readAddrFn) {
        readAddrFn();
    }

    var ops = {
        // LDA
        0xa9: ['LDA', lda, readImmediate, modes.immediate, 2],
        0xa5: ['LDA', lda, readZeroPage, modes.zeroPage, 3],
        0xb5: ['LDA', lda, readZeroPageX, modes.zeroPageX, 4],
        0xad: ['LDA', lda, readAbsolute, modes.absolute, 4],
        0xbd: ['LDA', lda, readAbsoluteX, modes.absoluteX, 4],
        0xb9: ['LDA', lda, readAbsoluteY, modes.absoluteY, 4],
        0xa1: ['LDA', lda, readZeroPageXIndirect, modes.zeroPageXIndirect, 6],
        0xb1: ['LDA', lda, readZeroPageIndirectY, modes.zeroPageIndirectY, 5],

        // LDX
        0xa2: ['LDX', ldx, readImmediate, modes.immediate, 2],
        0xa6: ['LDX', ldx, readZeroPage, modes.zeroPage, 3],
        0xb6: ['LDX', ldx, readZeroPageY, modes.zeroPageY, 4],
        0xae: ['LDX', ldx, readAbsolute, modes.absolute, 4],
        0xbe: ['LDX', ldx, readAbsoluteY, modes.absoluteY, 4],

        // LDY
        0xa0: ['LDY', ldy, readImmediate, modes.immediate, 2],
        0xa4: ['LDY', ldy, readZeroPage, modes.zeroPage, 3],
        0xb4: ['LDY', ldy, readZeroPageX, modes.zeroPageX, 4],
        0xac: ['LDY', ldy, readAbsolute, modes.absolute, 4],
        0xbc: ['LDY', ldy, readAbsoluteX, modes.absoluteX, 4],

        // STA
        0x85: ['STA', sta, writeZeroPage, modes.zeroPage, 3],
        0x95: ['STA', sta, writeZeroPageX, modes.zeroPageX, 4],
        0x8d: ['STA', sta, writeAbsolute, modes.absolute, 4],
        0x9d: ['STA', sta, writeAbsoluteX, modes.absoluteX, 5],
        0x99: ['STA', sta, writeAbsoluteY, modes.absoluteY, 5],
        0x81: ['STA', sta, writeZeroPageXIndirect, modes.zeroPageXIndirect, 6],
        0x91: ['STA', sta, writeZeroPageIndirectY, modes.zeroPageIndirectY, 6],

        // STX
        0x86: ['STX', stx, writeZeroPage, modes.zeroPage, 3],
        0x96: ['STX', stx, writeZeroPageY, modes.zeroPageY, 4],
        0x8e: ['STX', stx, writeAbsolute, modes.absolute, 4],

        // STY
        0x84: ['STY', sty, writeZeroPage, modes.zeroPage, 3],
        0x94: ['STY', sty, writeZeroPageX, modes.zeroPageX, 4],
        0x8c: ['STY', sty, writeAbsolute, modes.absolute, 4],

        // ADC
        0x69: ['ADC', adc, readImmediate, modes.immediate, 2],
        0x65: ['ADC', adc, readZeroPage, modes.zeroPage, 3],
        0x75: ['ADC', adc, readZeroPageX, modes.zeroPageX, 4],
        0x6D: ['ADC', adc, readAbsolute, modes.absolute, 4],
        0x7D: ['ADC', adc, readAbsoluteX, modes.absoluteX, 4],
        0x79: ['ADC', adc, readAbsoluteY, modes.absoluteY, 4],
        0x61: ['ADC', adc, readZeroPageXIndirect, modes.zeroPageXIndirect, 6],
        0x71: ['ADC', adc, readZeroPageIndirectY, modes.zeroPageIndirectY, 5],

        // SBC
        0xe9: ['SBC', sbc, readImmediate, modes.immediate, 2],
        0xe5: ['SBC', sbc, readZeroPage, modes.zeroPage, 3],
        0xf5: ['SBC', sbc, readZeroPageX, modes.zeroPageX, 4],
        0xeD: ['SBC', sbc, readAbsolute, modes.absolute, 4],
        0xfD: ['SBC', sbc, readAbsoluteX, modes.absoluteX, 4],
        0xf9: ['SBC', sbc, readAbsoluteY, modes.absoluteY, 4],
        0xe1: ['SBC', sbc, readZeroPageXIndirect, modes.zeroPageXIndirect, 6],
        0xf1: ['SBC', sbc, readZeroPageIndirectY, modes.zeroPageIndirectY, 5],

        // INC
        0xe6: ['INC', inc, readAddrZeroPage, modes.zeroPage, 5],
        0xf6: ['INC', inc, readAddrZeroPageX, modes.zeroPageX, 6],
        0xee: ['INC', inc, readAddrAbsolute, modes.absolute, 6],
        0xfe: ['INC', inc, readAddrAbsoluteX, modes.absoluteX, 7],

        // INX
        0xe8: ['INX', inx, null, modes.implied, 2],

        // INY
        0xc8: ['INY', iny, null, modes.implied, 2],

        // DEC
        0xc6: ['DEC', dec, readAddrZeroPage, modes.zeroPage, 5],
        0xd6: ['DEC', dec, readAddrZeroPageX, modes.zeroPageX, 6],
        0xce: ['DEC', dec, readAddrAbsolute, modes.absolute, 6],
        0xde: ['DEC', dec, readAddrAbsoluteX, modes.absoluteX, 7],

        // DEX
        0xca: ['DEX', dex, null, modes.implied, 2],

        // DEY
        0x88: ['DEY', dey, null, modes.implied, 2],

        // ASL
        0x0A: ['ASL', aslA, null, modes.accumulator, 2],
        0x06: ['ASL', asl, readAddrZeroPage, modes.zeroPage, 5],
        0x16: ['ASL', asl, readAddrZeroPageX, modes.zeroPageX, 6],
        0x0E: ['ASL', asl, readAddrAbsolute, modes.absolute, 6],
        0x1E: ['ASL', asl, readAddrAbsoluteX, modes.absoluteX, 7],

        // LSR
        0x4A: ['LSR', lsrA, null, modes.accumulator, 2],
        0x46: ['LSR', lsr, readAddrZeroPage, modes.zeroPage, 5],
        0x56: ['LSR', lsr, readAddrZeroPageX, modes.zeroPageX, 6],
        0x4E: ['LSR', lsr, readAddrAbsolute, modes.absolute, 6],
        0x5E: ['LSR', lsr, readAddrAbsoluteX, modes.absoluteX, 7],

        // ROL
        0x2A: ['ROL', rolA, null, modes.accumulator, 2],
        0x26: ['ROL', rol, readAddrZeroPage, modes.zeroPage, 5],
        0x36: ['ROL', rol, readAddrZeroPageX, modes.zeroPageX, 6],
        0x2E: ['ROL', rol, readAddrAbsolute, modes.absolute, 6],
        0x3E: ['ROL', rol, readAddrAbsoluteX, modes.absoluteX, 7],

        // ROR
        0x6A: ['ROR', rorA, null, modes.accumulator, 2],
        0x66: ['ROR', ror, readAddrZeroPage, modes.zeroPage, 5],
        0x76: ['ROR', ror, readAddrZeroPageX, modes.zeroPageX, 6],
        0x6E: ['ROR', ror, readAddrAbsolute, modes.absolute, 6],
        0x7E: ['ROR', ror, readAddrAbsoluteX, modes.absoluteX, 7],

        // AND
        0x29: ['AND', and, readImmediate, modes.immediate, 2],
        0x25: ['AND', and, readZeroPage, modes.zeroPage, 2],
        0x35: ['AND', and, readZeroPageX, modes.zeroPageX, 3],
        0x2D: ['AND', and, readAbsolute, modes.absolute, 4],
        0x3D: ['AND', and, readAbsoluteX, modes.absoluteX, 4],
        0x39: ['AND', and, readAbsoluteY, modes.absoluteY, 4],
        0x21: ['AND', and, readZeroPageXIndirect, modes.zeroPageXIndirect, 6],
        0x31: ['AND', and, readZeroPageIndirectY, modes.zeroPageIndirectY, 5],

        // ORA
        0x09: ['ORA', ora, readImmediate, modes.immediate, 2],
        0x05: ['ORA', ora, readZeroPage, modes.zeroPage, 2],
        0x15: ['ORA', ora, readZeroPageX, modes.zeroPageX, 3],
        0x0D: ['ORA', ora, readAbsolute, modes.absolute, 4],
        0x1D: ['ORA', ora, readAbsoluteX, modes.absoluteX, 4],
        0x19: ['ORA', ora, readAbsoluteY, modes.absoluteY, 4],
        0x01: ['ORA', ora, readZeroPageXIndirect, modes.zeroPageXIndirect, 6],
        0x11: ['ORA', ora, readZeroPageIndirectY, modes.zeroPageIndirectY, 5],

        // EOR
        0x49: ['EOR', eor, readImmediate, modes.immediate, 2],
        0x45: ['EOR', eor, readZeroPage, modes.zeroPage, 3],
        0x55: ['EOR', eor, readZeroPageX, modes.zeroPageX, 4],
        0x4D: ['EOR', eor, readAbsolute, modes.absolute, 4],
        0x5D: ['EOR', eor, readAbsoluteX, modes.absoluteX, 4],
        0x59: ['EOR', eor, readAbsoluteY, modes.absoluteY, 4],
        0x41: ['EOR', eor, readZeroPageXIndirect, modes.zeroPageXIndirect, 6],
        0x51: ['EOR', eor, readZeroPageIndirectY, modes.zeroPageIndirectY, 5],

        // CMP
        0xc9: ['CMP', cmp, readImmediate, modes.immediate, 2],
        0xc5: ['CMP', cmp, readZeroPage, modes.zeroPage, 3],
        0xd5: ['CMP', cmp, readZeroPageX, modes.zeroPageX, 4],
        0xcD: ['CMP', cmp, readAbsolute, modes.absolute, 4],
        0xdD: ['CMP', cmp, readAbsoluteX, modes.absoluteX, 4],
        0xd9: ['CMP', cmp, readAbsoluteY, modes.absoluteY, 4],
        0xc1: ['CMP', cmp, readZeroPageXIndirect, modes.zeroPageXIndirect, 6],
        0xd1: ['CMP', cmp, readZeroPageIndirectY, modes.zeroPageIndirectY, 5],

        // CPX
        0xE0: ['CPX', cpx, readImmediate, modes.immediate, 2],
        0xE4: ['CPX', cpx, readZeroPage, modes.zeroPage, 3],
        0xEC: ['CPX', cpx, readAbsolute, modes.absolute, 4],

        // CPY
        0xC0: ['CPY', cpy, readImmediate, modes.immediate, 2],
        0xC4: ['CPY', cpy, readZeroPage, modes.zeroPage, 3],
        0xCC: ['CPY', cpy, readAbsolute, modes.absolute, 4],

        // BIT
        0x24: ['BIT', bit, readZeroPage, modes.zeroPage, 3],
        0x2C: ['BIT', bit, readAbsolute, modes.absolute, 4],

        // BCC
        0x90: ['BCC', brc, flags.C, modes.relative, 2],

        // BCS
        0xB0: ['BCS', brs, flags.C, modes.relative, 2],

        // BEQ
        0xF0: ['BEQ', brs, flags.Z, modes.relative, 2],

        // BMI
        0x30: ['BMI', brs, flags.N, modes.relative, 2],

        // BNE
        0xD0: ['BNE', brc, flags.Z, modes.relative, 2],

        // BPL
        0x10: ['BPL', brc, flags.N, modes.relative, 2],

        // BVC
        0x50: ['BVC', brc, flags.V, modes.relative, 2],

        // BVS
        0x70: ['BVS', brs, flags.V, modes.relative, 2],

        // TAX
        0xAA: ['TAX', tax, null, modes.implied, 2],

        // TXA
        0x8A: ['TXA', txa, null, modes.implied, 2],

        // TAY
        0xA8: ['TAY', tay, null, modes.implied, 2],

        // TYA
        0x98: ['TYA', tya, null, modes.implied, 2],

        // TSX
        0xBA: ['TSX', tsx, null, modes.implied, 2],

        // TXS
        0x9A: ['TXS', txs, null, modes.implied, 2],

        // PHA
        0x48: ['PHA', pha, null, modes.implied, 3],

        // PLA
        0x68: ['PLA', pla, null, modes.implied, 4],

        // PHP
        0x08: ['PHP', php, null, modes.implied, 3],

        // PLP
        0x28: ['PLP', plp, null, modes.implied, 4],

        // JMP
        0x4C: [
            'JMP', jmp, readAddrAbsolute, modes.absolute, 3
        ],
        0x6C: [
            'JMP', jmp, readAddrAbsoluteIndirectBug, modes.absoluteIndirect, 5
        ],
        // JSR
        0x20: ['JSR', jsr, readAddrAbsolute, modes.absolute, 6],

        // RTS
        0x60: ['RTS', rts, null, modes.implied, 6],

        // RTI
        0x40: ['RTI', rti, null, modes.implied, 6],

        // SEC
        0x38: ['SEC', set, flags.C, modes.implied, 2],

        // SED
        0xF8: ['SED', set, flags.D, modes.implied, 2],

        // SEI
        0x78: ['SEI', set, flags.I, modes.implied, 2],

        // CLC
        0x18: ['CLC', clr, flags.C, modes.implied, 2],

        // CLD
        0xD8: ['CLD', clr, flags.D, modes.implied, 2],

        // CLI
        0x58: ['CLI', clr, flags.I, modes.implied, 2],

        // CLV
        0xB8: ['CLV', clr, flags.V, modes.implied, 2],

        // NOP
        0xea: ['NOP', nop, readImplied, modes.implied, 2],

        // BRK
        0x00: ['BRK', brk, readImmediate, modes.immediate, 7]
    };

    /* 65C02 Instructions */

    var cops = {
        // INC / DEC A
        0x1A: ['INC', incA, null, modes.accumulator, 2],
        0x3A: ['DEC', decA, null, modes.accumulator, 2],

        // Indirect Zero Page for the masses
        0x12: ['ORA', ora, readZeroPageIndirect, modes.zeroPageIndirect, 5],
        0x32: ['AND', and, readZeroPageIndirect, modes.zeroPageIndirect, 5],
        0x52: ['EOR', eor, readZeroPageIndirect, modes.zeroPageIndirect, 5],
        0x72: ['ADC', adc, readZeroPageIndirect, modes.zeroPageIndirect, 5],
        0x92: ['STA', sta, writeZeroPageIndirect, modes.zeroPageIndirect, 5],
        0xB2: ['LDA', lda, readZeroPageIndirect, modes.zeroPageIndirect, 5],
        0xD2: ['CMP', cmp, readZeroPageIndirect, modes.zeroPageIndirect, 5],
        0xF2: ['SBC', sbc, readZeroPageIndirect, modes.zeroPageIndirect, 5],

        // Better BIT
        0x34: ['BIT', bit, readZeroPageX, modes.zeroPageX, 4],
        0x3C: ['BIT', bit, readAbsoluteX, modes.absoluteX, 4],
        0x89: ['BIT', bitI, readImmediate, modes.immediate, 2],

        // JMP absolute indirect indexed
        0x6C: [
            'JMP', jmp, readAddrAbsoluteIndirect, modes.absoluteIndirect, 6
        ],
        0x7C: [
            'JMP', jmp, readAddrAbsoluteXIndirect, modes.absoluteXIndirect, 6
        ],

        // BBR/BBS
        0x0F: ['BBR0', bbr, 0, modes.zeroPage_relative, 5],
        0x1F: ['BBR1', bbr, 1, modes.zeroPage_relative, 5],
        0x2F: ['BBR2', bbr, 2, modes.zeroPage_relative, 5],
        0x3F: ['BBR3', bbr, 3, modes.zeroPage_relative, 5],
        0x4F: ['BBR4', bbr, 4, modes.zeroPage_relative, 5],
        0x5F: ['BBR5', bbr, 5, modes.zeroPage_relative, 5],
        0x6F: ['BBR6', bbr, 6, modes.zeroPage_relative, 5],
        0x7F: ['BBR7', bbr, 7, modes.zeroPage_relative, 5],

        0x8F: ['BBS0', bbs, 0, modes.zeroPage_relative, 5],
        0x9F: ['BBS1', bbs, 1, modes.zeroPage_relative, 5],
        0xAF: ['BBS2', bbs, 2, modes.zeroPage_relative, 5],
        0xBF: ['BBS3', bbs, 3, modes.zeroPage_relative, 5],
        0xCF: ['BBS4', bbs, 4, modes.zeroPage_relative, 5],
        0xDF: ['BBS5', bbs, 5, modes.zeroPage_relative, 5],
        0xEF: ['BBS6', bbs, 6, modes.zeroPage_relative, 5],
        0xFF: ['BBS7', bbs, 7, modes.zeroPage_relative, 5],

        // BRA
        0x80: ['BRA', brc, 0, modes.relative, 2],

        // NOP
        0x02: ['NOP', nop, readImmediate, modes.immediate, 2],
        0x22: ['NOP', nop, readImmediate, modes.immediate, 2],
        0x42: ['NOP', nop, readImmediate, modes.immediate, 2],
        0x44: ['NOP', nop, readImmediate, modes.immediate, 3],
        0x54: ['NOP', nop, readImmediate, modes.immediate, 4],
        0x62: ['NOP', nop, readImmediate, modes.immediate, 2],
        0x82: ['NOP', nop, readImmediate, modes.immediate, 2],
        0xC2: ['NOP', nop, readImmediate, modes.immediate, 2],
        0xD4: ['NOP', nop, readImmediate, modes.immediate, 4],
        0xE2: ['NOP', nop, readImmediate, modes.immediate, 2],
        0xF4: ['NOP', nop, readImmediate, modes.immediate, 4],
        0x5C: ['NOP', nop, readAbsolute, modes.absolute, 8],
        0xDC: ['NOP', nop, readAbsolute, modes.absolute, 4],
        0xFC: ['NOP', nop, readAbsolute, modes.absolute, 4],

        // PHX
        0xDA: ['PHX', phx, null, modes.implied, 3],

        // PHY
        0x5A: ['PHY', phy, null, modes.implied, 3],

        // PLX
        0xFA: ['PLX', plx, null, modes.implied, 4],

        // PLY
        0x7A: ['PLY', ply, null, modes.implied, 4],

        // RMB/SMB

        0x07: ['RMB0', rmb, 0, modes.zeroPage, 5],
        0x17: ['RMB1', rmb, 1, modes.zeroPage, 5],
        0x27: ['RMB2', rmb, 2, modes.zeroPage, 5],
        0x37: ['RMB3', rmb, 3, modes.zeroPage, 5],
        0x47: ['RMB4', rmb, 4, modes.zeroPage, 5],
        0x57: ['RMB5', rmb, 5, modes.zeroPage, 5],
        0x67: ['RMB6', rmb, 6, modes.zeroPage, 5],
        0x77: ['RMB7', rmb, 7, modes.zeroPage, 5],

        0x87: ['SMB0', smb, 0, modes.zeroPage, 5],
        0x97: ['SMB1', smb, 1, modes.zeroPage, 5],
        0xA7: ['SMB2', smb, 2, modes.zeroPage, 5],
        0xB7: ['SMB3', smb, 3, modes.zeroPage, 5],
        0xC7: ['SMB4', smb, 4, modes.zeroPage, 5],
        0xD7: ['SMB5', smb, 5, modes.zeroPage, 5],
        0xE7: ['SMB6', smb, 6, modes.zeroPage, 5],
        0xF7: ['SMB7', smb, 7, modes.zeroPage, 5],

        // STZ
        0x64: ['STZ', stz, writeZeroPage, modes.zeroPage, 3],
        0x74: ['STZ', stz, writeZeroPageX, modes.zeroPageX, 4],
        0x9C: ['STZ', stz, writeAbsolute, modes.absolute, 4],
        0x9E: ['STZ', stz, writeAbsoluteX, modes.absoluteX, 5],

        // TRB
        0x14: ['TRB', trb, readAddrZeroPage, modes.zeroPage, 5],
        0x1C: ['TRB', trb, readAddrAbsolute, modes.absolute, 6],

        // TSB
        0x04: ['TSB', tsb, readAddrZeroPage, modes.zeroPage, 5],
        0x0C: ['TSB', tsb, readAddrAbsolute, modes.absolute, 6]
    };

    if (is65C02) {
        for (var key in cops) {
            if (cops.hasOwnProperty(key)) {
                if (key in ops) {
                    debug('overriding opcode ' + toHex(key));
                }
                ops[key] = cops[key];
            }
        }
    }

    function unknown(b) {
        var unk;

        if (is65C02) {
            unk = [
                'NOP',
                nop,
                readImplied,
                modes.implied,
                2
            ];
        } else {
            unk = [
                '???',
                function() {
                /*
                    debug('Unknown OpCode: ' + toHex(b) +
                          ' at ' + toHex(pc - 1, 4));
                */
                },
                readImplied,
                modes.implied,
                1
            ];
        }
        ops[b] = unk;
        return unk;
    }

    /* Certain browsers benefit from using arrays over maps */
    var opary = [];

    for (idx = 0; idx < 0x100; idx++) {
        opary[idx] = ops[idx] || unknown(idx);
    }

    function dumpArgs(addr, m, symbols) {
        var val;
        var off;
        function toHexOrSymbol(v, n) {
            if (symbols && symbols[v]) {
                return symbols[v];
            } else {
                return '$' + toHex(v, n);
            }
        }
        var result = '';
        switch (m) {
        case modes.implied:
            break;
        case modes.immediate:
            result = '#' + toHexOrSymbol(readByte(addr, true));
            break;
        case modes.absolute:
            result = '' + toHexOrSymbol(readWord(addr, true), 4);
            break;
        case modes.zeroPage:
            result = '' + toHexOrSymbol(readByte(addr, true));
            break;
        case modes.relative:
            {
                off = readByte(addr, true);
                if (off > 127) {
                    off -= 256;
                }
                addr += off + 1;
                result = '' + toHexOrSymbol(addr, 4) + ' (' + off + ')';
            }
            break;
        case modes.absoluteX:
            result = '' + toHexOrSymbol(readWord(addr, true), 4) + ',X';
            break;
        case modes.absoluteY:
            result = '' + toHexOrSymbol(readWord(addr, true), 4) + ',Y';
            break;
        case modes.zeroPageX:
            result = '' + toHexOrSymbol(readByte(addr, true)) + ',X';
            break;
        case modes.zeroPageY:
            result = '' + toHexOrSymbol(readByte(addr, true)) + ',Y';
            break;
        case modes.absoluteIndirect:
            result = '(' + toHexOrSymbol(readWord(addr, true), 4) + ')';
            break;
        case modes.zeroPageXIndirect:
            result = '(' + toHexOrSymbol(readByte(addr, true)) + ',X)';
            break;
        case modes.zeroPageIndirectY:
            result = '(' + toHexOrSymbol(readByte(addr, true)) + '),Y';
            break;
        case modes.accumulator:
            result = 'A';
            break;
        case modes.zeroPageIndirect:
            result = '(' + toHexOrSymbol(readByte(addr, true)) + ')';
            break;
        case modes.absoluteXIndirect:
            result = '(' + toHexOrSymbol(readWord(addr, true), 4) + ',X)';
            break;
        case modes.zeroPage_relative:
            val = readByte(addr, true);
            off = readByte(addr + 1, true);
            if (off > 127) {
                off -= 256;
            }
            addr += off + 2;
            result = '' + toHexOrSymbol(val) + ',' + toHexOrSymbol(addr, 4) + ' (' + off + ')';
            break;
        default:
            break;
        }
        return result;
    }

    return {
        step: function cpu_step(cb) {
            sync = true;
            var op = opary[readBytePC()];
            sync = false;

            op[1](op[2]);
            cycles += op[4];

            if (cb) {
                inCallback = true;
                cb(this);
                inCallback = false;
            }
        },

        stepN: function(n) {
            var op, idx;

            for (idx = 0; idx < n; idx++) {
                sync = true;
                op = opary[readBytePC()];
                sync = false;
                op[1](op[2]);
                cycles += op[4];
            }
        },

        stepCycles: function(c) {
            var op, end = cycles + c;

            while (cycles < end) {
                sync = true;
                op = opary[readBytePC()];
                sync = false;
                op[1](op[2]);
                cycles += op[4];
            }
        },

        stepCyclesDebug: function(c, cb)
        {
            var op, end = cycles + c;

            if (inCallback) {
                return;
            }

            while (cycles < end) {
                sync = true;
                op = opary[readBytePC()];
                sync = false;
                op[1](op[2]);
                cycles += op[4];

                if (cb) {
                    inCallback = true;
                    cb(this);
                    inCallback = false;
                }
            }
        },

        addPageHandler: function(pho) {
            for (var idx = pho.start(); idx <= pho.end(); idx++) {
                if (pho.read)
                    readPages[idx] = pho;
                if (pho.write)
                    writePages[idx] = pho;
            }
            if (pho.reset)
                resetHandlers.push(pho);
        },

        reset: function cpu_reset()
        {
            // cycles = 0;
            sr = 0x20;
            sp = 0xff;
            ar = 0;
            yr = 0;
            xr = 0;
            pc = readWord(loc.RESET);

            for (var idx = 0; idx < resetHandlers.length; idx++) {
                resetHandlers[idx].reset();
            }
        },

        /* IRQ - Interupt Request */
        irq: function cpu_irq()
        {
            if ((sr & flags.I) === 0) {
                pushWord(pc);
                pushByte(sr & ~flags.B);
                if (is65C02) {
                    setFlag(flags.D, false);
                }
                setFlag(flags.I, true);
                pc = readWord(loc.BRK);
            }
        },

        /* NMI Non-maskable Interrupt */
        nmi: function cpu_nmi()
        {
            pushWord(pc);
            pushByte(sr & ~flags.B);
            if (is65C02) {
                setFlag(flags.D, false);
            }
            setFlag(flags.I, true);
            pc = readWord(loc.NMI);
        },

        getPC: function () {
            return pc;
        },

        setPC: function(_pc) {
            pc = _pc;
        },

        dumpPC: function(_pc, symbols) {
            if (_pc === undefined) {
                _pc = pc;
            }
            var b = readByte(_pc, true),
                op = ops[b],
                size = sizes[op[3]],
                result = toHex(_pc, 4) + '- ';

            if (symbols) {
                if (symbols[_pc]) {
                    result += symbols[_pc] +
                        '          '.substring(symbols[_pc].length);
                } else {
                    result += '          ';
                }
            }

            for (var idx = 0; idx < 4; idx++) {
                if (idx < size) {
                    result += toHex(readByte(_pc + idx, true)) + ' ';
                } else {
                    result += '   ';
                }
            }

            if (op === undefined)
                result += '??? (' + toHex(b) + ')';
            else
                result += op[0] + ' ' + dumpArgs(_pc + 1, op[3], symbols);

            return result;
        },

        dumpPage: function(start, end) {
            var result = '';
            if (start === undefined) {
                start = pc >> 8;
            }
            if (end === undefined) {
                end = start;
            }
            for (var page = start; page <= end; page++) {
                var b, idx, jdx;
                for (idx = 0; idx < 16; idx++) {
                    result += toHex(page) + toHex(idx << 4) + ': ';
                    for (jdx = 0; jdx < 16; jdx++) {
                        b = readByte(page * 256 + idx * 16 + jdx, true);
                        result += toHex(b) + ' ';
                    }
                    result += '        ';
                    for (jdx = 0; jdx < 16; jdx++) {
                        b = readByte(page * 256 + idx * 16 + jdx, true) & 0x7f;
                        if (b >= 0x20 && b < 0x7f) {
                            result += String.fromCharCode(b);
                        } else {
                            result += '.';
                        }
                    }
                    result += '\n';
                }
            }
            return result;
        },

        list: function(_pc, symbols) {
            if (_pc === undefined) {
                _pc = pc;
            }
            var results = [];
            for (var jdx = 0; jdx < 20; jdx++) {
                var b = readByte(_pc), op = ops[b];
                results.push(this.dumpPC(_pc, symbols));
                _pc += sizes[op[3]];
            }
            return results;
        },

        sync: function() {
            return sync;
        },

        cycles: function() {
            return cycles;
        },

        registers: function() {
            return [pc,ar,xr,yr,sr,sp];
        },

        getState: function() {
            return {
                a: ar,
                x: xr,
                y: yr,
                s: sr,
                pc: pc,
                sp: sp,
                cycles: cycles
            };
        },

        setState: function(state) {
            ar = state.a;
            xr = state.x;
            yr = state.y;
            sr = state.s;
            pc = state.pc;
            sp = state.sp;
            cycles = state.cycles;
        },

        dumpRegisters: function() {
            return toHex(pc, 4) +
                '-   A=' + toHex(ar) +
                ' X=' + toHex(xr) +
                ' Y=' + toHex(yr) +
                ' P=' + toHex(sr) +
                ' S=' + toHex(sp) +
                ' ' +
                ((sr & flags.N) ? 'N' : '-') +
                ((sr & flags.V) ? 'V' : '-') +
                '-' +
                ((sr & flags.B) ? 'B' : '-') +
                ((sr & flags.D) ? 'D' : '-') +
                ((sr & flags.I) ? 'I' : '-') +
                ((sr & flags.Z) ? 'Z' : '-') +
                ((sr & flags.C) ? 'C' : '-');
        },

        read: function(page, off) {
            return readPages[page].read(page, off, false);
        },

        write: function(page, off, val) {
            writePages[page].write(page, off, val);
        }
    };
}
