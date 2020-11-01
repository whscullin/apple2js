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

import { byte, word } from './types';
import { debug, toHex } from './util';

type symbols = { [key: number]: string };

export interface CpuOptions {
    '65C02'?: boolean;
}

export interface CpuState {
        a: byte,
        x: byte,
        y: byte,
        s: byte,
        pc: word,
        sp: byte,
        cycles: number
}

/** Range of mode numbers. */
type mode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

/** Addressing mode name to number mapping. */
const modes: { [key: string]: mode } = {
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

/** Instruction size by addressing mode. */
const sizes = {
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

/** Status register flag numbers. */
type flag = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Flags to status byte mask. */
const flags = {
    N: 0x80, // Negative
    V: 0x40, // oVerflow
    B: 0x10, // Break
    D: 0x08, // Decimal
    I: 0x04, // Interrupt
    Z: 0x02, // Zero
    C: 0x01  // Carry
};

/** CPU-referenced memory locations. */
const loc = {
    STACK: 0x100,
    NMI: 0xFFFA,
    RESET: 0xFFFC,
    BRK: 0xFFFE
};

interface ReadablePage {
    read(page: byte, offset: byte): byte;
}

function isReadablePage(page: ReadablePage | any): page is ReadablePage {
    return (page as ReadablePage).read !== undefined;
}

interface WriteablePage {
    write(page: byte, offset: byte, value: byte): void;
}

function isWriteablePage(page: WriteablePage | any): page is WriteablePage {
    return (page as WriteablePage).write !== undefined;
}

interface PageHandler {
    start(): byte;
    end(): byte;
}

function isResettablePageHandler(pageHandler: PageHandler | ResettablePageHandler): pageHandler is ResettablePageHandler {
    return (pageHandler as ResettablePageHandler).reset !== undefined;
}

interface ResettablePageHandler extends PageHandler {
    reset(): void;
}

const BLANK_PAGE: ReadablePage & WriteablePage = {
    read: function() { return 0; },
    write: function() {}
};

interface Opts {
    rwm?: boolean;
}

type ReadFn = () => byte;
type WriteFn = (val: byte) => void;
type ReadAddrFn = (opts?: Opts) => word;

type readInstruction = [
    desc: string,
    op: (readFn: ReadFn) => void,
    modeFn: ReadFn,
    mode: mode, // really 0-15
    cycles: number,
];

type writeInstruction = [
    desc: string,
    op: (writeFn: WriteFn) => void,
    modeFn: WriteFn,
    mode: mode, // really 0-15
    cycles: number,
];

type impliedInstruction = [
    desc: string,
    op: () => void,
    modeFn: null,
    mode: mode, // really 0-15
    cycles: number,
];

type relativeInstruction = [
    desc: string,
    op: (f: byte) => void,
    modeFn: byte,
    mode: mode, // really 0-15
    cycles: number,
];

type noopInstruction = [
    desc: string,
    op: (readAddrFn: ReadAddrFn) => void,
    modeFn: () => void,
    mode: mode, // really 0-15
    cycles: number,
];

type instruction =
    readInstruction | writeInstruction |
    impliedInstruction | relativeInstruction | noopInstruction;

interface Instructions {
    [key: number]: instruction;
}

type callback = (cpu: any) => void; // TODO(flan): Hack until there is better typing.

function bind(op: instruction, o: CPU6502): instruction {
    let op2: instruction[2] = typeof op[2] === "function" ? op[2].bind(o) : op[2];
    return [op[0], op[1].bind(o), op2, op[3], op[4]];
}

export default class CPU6502 {
    private readonly is65C02;

    /* Registers */
    private pc = 0; // Program Counter
    private sr = 0x20; // Process Status Register
    private ar = 0; // Accumulator
    private xr = 0; // X Register
    private yr = 0; // Y Register
    private sp = 0xff; // Stack Pointer

    private readPages: ReadablePage[] = [];
    private writePages: WriteablePage[] = [];
    private resetHandlers: ResettablePageHandler[] = [];
    private cycles = 0;
    private sync = false;

    private readonly ops: Instructions;
    private readonly opary: instruction[];

    constructor(options: CpuOptions = {}) {
        this.is65C02 = options['65C02'] ? true : false;

        for (let idx = 0; idx < 0x100; idx++) {
            this.readPages[idx] = BLANK_PAGE;
            this.writePages[idx] = BLANK_PAGE;
        }

        // Create this CPU's instruction table
        let ops: Instructions = [];
        Object.assign(ops, OPS_6502);
        if (this.is65C02) {
            Object.assign(ops, OPS_65C02);
        }
        this.ops = ops;

        // Certain browsers benefit from using arrays over maps
        let opary: instruction[] = [];

        for (let idx = 0; idx < 0x100; idx++) {
            opary[idx] = bind(ops[idx] || this.unknown(idx), this);
        }
        this.opary = opary;
    }

    /**
     * Set or clears `f` in the status register. `f` must be a byte with a
     * single bit set.
     */
    private setFlag(f: byte, on: boolean) {
        this.sr = on ? (this.sr | f) : (this.sr & ~f);
    }

    /** Updates the status register's zero flag and negative flag. */
    private testNZ(val: byte) {
        this.sr = val === 0 ? (this.sr | flags.Z) : (this.sr & ~flags.Z);
        this.sr = (val & 0x80) ? (this.sr | flags.N) : (this.sr & ~flags.N);

        return val;
    }

    /** Updates the status register's zero flag. */
    private testZ(val: byte) {
        this.sr = val === 0 ? (this.sr | flags.Z) : (this.sr & ~flags.Z);

        return val;
    }

    /**
     * Returns `a + b`, unless `sub` is true, in which case it performs
     * `a - b`. The status register is updated according to the result.
     */
    private add(a: byte, b: byte, sub: boolean) {
        if (sub)
            b ^= 0xff;

        // KEGS
        var c, v;
        if ((this.sr & flags.D) !== 0) {
            // BCD
            c = (a & 0x0f) + (b & 0x0f) + (this.sr & flags.C);
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
            c = a + b + (this.sr & flags.C);
            v = (c ^ a) & 0x80;
        }

        if (((a ^ b) & 0x80) !== 0) {
            v = 0;
        }

        this.setFlag(flags.C, c > 0xff);
        this.setFlag(flags.V, !!v);

        return this.testNZ(c & 0xff);
    }

    /** Increments `a` and returns the value, setting the status register. */
    private increment(a: byte) {
        return this.testNZ((a + 0x01) & 0xff);
    }

    private decrement(a: byte) {
        return this.testNZ((a + 0xff) & 0xff);
    }

    private readBytePC(): byte {
        let addr = this.pc,
            page = addr >> 8,
            off = addr & 0xff;

        var result = this.readPages[page].read(page, off);

        this.pc = (this.pc + 1) & 0xffff;

        this.cycles++;

        return result;
    }

    private readByte(addr: word): byte {
        var page = addr >> 8,
            off = addr & 0xff;

        var result = this.readPages[page].read(page, off);

        this.cycles++;

        return result;
    }

    private readByteDebug(addr: word) {
        var page = addr >> 8,
            off = addr & 0xff;

        return this.readPages[page].read(page, off);
    }

    private writeByte(addr: word, val: byte) {
        var page = addr >> 8,
            off = addr & 0xff;

        this.writePages[page].write(page, off, val);

        this.cycles++;
    }

    private readWord(addr: word): word {
        return this.readByte(addr) | (this.readByte(addr + 1) << 8);
    }

    private readWordDebug(addr: word): word {
        return this.readByteDebug(addr) | (this.readByteDebug(addr + 1) << 8);
    }

    private readWordPC(): word {
        return this.readBytePC() | (this.readBytePC() << 8);
    }

    private readZPWord(addr: byte): word {
        var lsb, msb;

        lsb = this.readByte(addr & 0xff);
        msb = this.readByte((addr + 1) & 0xff);

        return (msb << 8) | lsb;
    }

    private pushByte(val: byte) {
        this.writeByte(loc.STACK | this.sp, val);
        this.sp = (this.sp + 0xff) & 0xff;
    }

    private pushWord(val: word) {
        this.pushByte(val >> 8);
        this.pushByte(val & 0xff);
    }

    private pullByte(): byte {
        this.sp = (this.sp + 0x01) & 0xff;
        return this.readByte(loc.STACK | this.sp);
    }

    private pullWordRaw(): word {
        var lsb = this.pullByte();
        var msb = this.pullByte();

        return (msb << 8) | lsb;
    }

    /*
     * Read functions
     */

    readImplied() {
    }

    // #$00
    readImmediate(): byte {
        return this.readBytePC();
    }

    // $0000
    readAbsolute(): byte {
        return this.readByte(this.readWordPC());
    }

    // $00
    readZeroPage(): byte {
        return this.readByte(this.readBytePC());
    }

    // $0000,X
    readAbsoluteX(): byte {
        var addr = this.readWordPC();
        var oldPage = addr >> 8;
        addr = (addr + this.xr) & 0xffff;
        var newPage = addr >> 8;
        if (newPage != oldPage) {
            var off = addr & 0xff;
            this.readByte(oldPage << 8 | off);
        }
        return this.readByte(addr);
    }

    // $0000,Y
    readAbsoluteY(): byte {
        var addr = this.readWordPC();
        var oldPage = addr >> 8;
        addr = (addr + this.yr) & 0xffff;
        var newPage = addr >> 8;
        if (newPage != oldPage) {
            var off = addr & 0xff;
            this.readByte(oldPage << 8 | off);
        }
        return this.readByte(addr);
    }

    // $00,X
    readZeroPageX(): byte {
        var zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        return this.readByte((zpAddr + this.xr) & 0xff);
    }

    // $00,Y
    readZeroPageY(): byte {
        var zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        return this.readByte((zpAddr + this.yr) & 0xff);
    }

    // ($00,X)
    readZeroPageXIndirect(): byte {
        var zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        var addr = this.readZPWord((zpAddr + this.xr) & 0xff);
        return this.readByte(addr);
    }

    // ($00),Y
    readZeroPageIndirectY(): byte {
        var addr = this.readZPWord(this.readBytePC());
        var oldPage = addr >> 8;
        addr = (addr + this.yr) & 0xffff;
        var newPage = addr >> 8;
        if (newPage != oldPage) {
            var off = addr & 0xff;
            this.readByte(oldPage << 8 | off);
        }
        return this.readByte(addr);
    }

    // ($00) (65C02)
    readZeroPageIndirect(): byte {
        return this.readByte(this.readZPWord(this.readBytePC()));
    }

    /*
     * Write Functions
     */

    // $0000
    writeAbsolute(val: byte) {
        this.writeByte(this.readWordPC(), val);
    }

    // $00
    writeZeroPage(val: byte) {
        this.writeByte(this.readBytePC(), val);
    }

    // $0000,X
    writeAbsoluteX(val: byte) {
        var addr = this.readWordPC(), oldPage = addr >> 8;
        addr = (addr + this.xr) & 0xffff;
        var off = addr & 0xff;
        this.readByte(oldPage << 8 | off);
        this.writeByte(addr, val);
    }

    // $0000,Y
    writeAbsoluteY(val: byte) {
        var addr = this.readWordPC(), oldPage = addr >> 8;
        addr = (addr + this.yr) & 0xffff;
        var off = addr & 0xff;
        this.readByte(oldPage << 8 | off);
        this.writeByte(addr, val);
    }

    // $00,X
    writeZeroPageX(val: byte) {
        var zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        this.writeByte((zpAddr + this.xr) & 0xff, val);
    }

    // $00,Y
    writeZeroPageY(val: byte) {
        var zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        this.writeByte((zpAddr + this.yr) & 0xff, val);
    }

    // ($00,X)
    writeZeroPageXIndirect(val: byte) {
        var zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        var addr = this.readZPWord((zpAddr + this.xr) & 0xff);
        this.writeByte(addr, val);
    }

    // ($00),Y
    writeZeroPageIndirectY(val: byte) {
        var addr = this.readZPWord(this.readBytePC()), oldPage = addr >> 8;
        addr = (addr + this.yr) & 0xffff;
        var off = addr & 0xff;
        this.readByte(oldPage << 8 | off);
        this.writeByte(addr, val);
    }

    // ($00) (65C02)
    writeZeroPageIndirect(val: byte) {
        this.writeByte(this.readZPWord(this.readBytePC()), val);
    }

    // $00
    readAddrZeroPage(): byte {
        return this.readBytePC();
    }

    // $00,X
    readAddrZeroPageX() {
        var zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        return (zpAddr + this.xr) & 0xff;
    }

    // $0000 (65C02)
    readAddrAbsolute(): word {
        return this.readWordPC();
    }

    // ($0000) (6502)
    readAddrAbsoluteIndirectBug(): word {
        var addr = this.readWordPC();
        var page = addr & 0xff00;
        var off = addr & 0x00ff;
        var lsb = this.readByte(addr);
        var msb = this.readByte(page | ((off + 0x01) & 0xff));
        return msb << 8 | lsb;
    }

    // ($0000) (65C02)
    readAddrAbsoluteIndirect(): word {
        var lsb = this.readBytePC();
        var msb = this.readBytePC();
        this.readByte(this.pc);
        return this.readWord(msb << 8 | lsb);
    }

    // $0000,X
    readAddrAbsoluteX(opts: Opts = {}): word {
        var addr = this.readWordPC();
        if (!this.is65C02 || opts.rwm) {
            this.readByte(addr);
        } else {
            this.readByte(this.pc);
        }
        return (addr + this.xr) & 0xffff;
    }

    // $(0000,X) (65C02)
    readAddrAbsoluteXIndirect(): word {
        var address = this.readWordPC();
        this.readByte(this.pc);
        return this.readWord((address + this.xr) & 0xffff);
    }

    /* Break */
    brk(readFn: ReadFn) {
        readFn();
        this.pushWord(this.pc);
        this.pushByte(this.sr | flags.B);
        if (this.is65C02) {
            this.setFlag(flags.D, false);
        }
        this.setFlag(flags.I, true);
        this.pc = this.readWord(loc.BRK);
    }

    /* Load Accumulator */
    lda(readFn: ReadFn) {
        this.ar = this.testNZ(readFn());
    }

    /* Load X Register */
    ldx(readFn: ReadFn) {
        this.xr = this.testNZ(readFn());
    }

    /* Load Y Register */
    ldy(readFn: ReadFn) {
        this.yr = this.testNZ(readFn());
    }

    /* Store Accumulator */
    sta(writeFn: WriteFn) {
        writeFn(this.ar);
    }

    /* Store X Register */
    stx(writeFn: WriteFn) {
        writeFn(this.xr);
    }

    /* Store Y Register */
    sty(writeFn: WriteFn) {
        writeFn(this.yr);
    }

    /* Store Zero */
    stz(writeFn: WriteFn) {
        writeFn(0);
    }

    /* Add with Carry */
    adc(readFn: ReadFn) {
        this.ar = this.add(this.ar, readFn(), /* sub= */ false);
    }

    /* Subtract with Carry */
    sbc(readFn: ReadFn) {
        this.ar = this.add(this.ar, readFn(), /* sub= */ true);
    }

    /* Increment Memory */
    incA() {
        this.readByte(this.pc);
        this.ar = this.increment(this.ar);
    }

    inc(readAddrFn: ReadAddrFn) {
        var addr = readAddrFn({rwm: true});
        var oldVal = this.readByte(addr);
        this.writeByte(addr, oldVal);
        var val = this.increment(oldVal);
        this.writeByte(addr, val);
    }

    /* Increment X */
    inx() {
        this.readByte(this.pc);
        this.xr = this.increment(this.xr);
    }

    /* Increment Y */
    iny() {
        this.readByte(this.pc);
        this.yr = this.increment(this.yr);
    }

    /* Decrement Memory */
    decA() {
        this.readByte(this.pc);
        this.ar = this.decrement(this.ar);
    }

    dec(readAddrFn: ReadAddrFn) {
        var addr = readAddrFn({rwm: true});
        var oldVal = this.readByte(addr);
        this.writeByte(addr, oldVal);
        var val = this.decrement(oldVal);
        this.writeByte(addr, val);
    }

    /* Decrement X */
    dex() {
        this.readByte(this.pc);
        this.xr = this.decrement(this.xr);
    }

    /* Decrement Y */
    dey() {
        this.readByte(this.pc);
        this.yr = this.decrement(this.yr);
    }

    shiftLeft(val: byte) {
        this.setFlag(flags.C, !!(val & 0x80));
        return this.testNZ((val << 1) & 0xff);
    }

    /* Arithmetic Shift Left */
    aslA() {
        this.readByte(this.pc);
        this.ar = this.shiftLeft(this.ar);
    }

    asl(readAddrFn: ReadAddrFn) {
        var addr = readAddrFn({rwm: true});
        var oldVal = this.readByte(addr);
        this.writeByte(addr, oldVal);
        var val = this.shiftLeft(oldVal);
        this.writeByte(addr, val);
    }

    shiftRight(val: byte) {
        this.setFlag(flags.C, !!(val & 0x01));
        return this.testNZ(val >> 1);
    }

    /* Logical Shift Right */
    lsrA() {
        this.readByte(this.pc);
        this.ar = this.shiftRight(this.ar);
    }

    lsr(readAddrFn: ReadAddrFn) {
        var addr = readAddrFn({rwm: true});
        var oldVal = this.readByte(addr);
        this.writeByte(addr, oldVal);
        var val = this.shiftRight(oldVal);
        this.writeByte(addr, val);
    }

    rotateLeft(val: byte) {
        var c = (this.sr & flags.C);
        this.setFlag(flags.C, !!(val & 0x80));
        return this.testNZ(((val << 1) | (c ? 0x01 : 0x00)) & 0xff);
    }

    /* Rotate Left */
    rolA() {
        this.readByte(this.pc);
        this.ar = this.rotateLeft(this.ar);
    }

    rol(readAddrFn: ReadAddrFn) {
        var addr = readAddrFn({rwm: true});
        var oldVal = this.readByte(addr);
        this.writeByte(addr, oldVal);
        var val = this.rotateLeft(oldVal);
        this.writeByte(addr, val);
    }

    private rotateRight(a: byte) {
        var c = (this.sr & flags.C);
        this.setFlag(flags.C, !!(a & 0x01));
        return this.testNZ((a >> 1) | (c ? 0x80 : 0x00));
    }

    /* Rotate Right */
    rorA() {
        this.readByte(this.pc);
        this.ar = this.rotateRight(this.ar);
    }

    ror(readAddrFn: ReadAddrFn) {
        var addr = readAddrFn({rwm: true});
        var oldVal = this.readByte(addr);
        this.writeByte(addr, oldVal);
        var val = this.rotateRight(oldVal);
        this.writeByte(addr, val);
    }

    /* Logical And Accumulator */
    and(readFn: ReadFn) {
        this.ar = this.testNZ(this.ar & readFn());
    }

    /* Logical Or Accumulator */
    ora(readFn: ReadFn) {
        this.ar = this.testNZ(this.ar | readFn());
    }

    /* Logical Exclusive Or Accumulator */
    eor(readFn: ReadFn) {
        this.ar = this.testNZ(this.ar ^ readFn());
    }

    /* Reset Bit */

    rmb(b: byte) {
        var bit = (0x1 << b) ^ 0xFF;
        var addr = this.readBytePC();
        var val = this.readByte(addr);
        this.readByte(addr);
        val &= bit;
        this.writeByte(addr, val);
    }

    /* Set Bit */

    smb(b: byte) {
        var bit = 0x1 << b;
        var addr = this.readBytePC();
        var val = this.readByte(addr);
        this.readByte(addr);
        val |= bit;
        this.writeByte(addr, val);
    }

    /* Test and Reset Bits */
    trb(readAddrFn: ReadAddrFn) {
        var addr = readAddrFn();
        var val = this.readByte(addr);
        this.testZ(val & this.ar);
        this.readByte(addr);
        this.writeByte(addr, val & ~this.ar);
    }

    /* Test and Set Bits */
    tsb(readAddrFn: ReadAddrFn) {
        var addr = readAddrFn();
        var val = this.readByte(addr);
        this.testZ(val & this.ar);
        this.readByte(addr);
        this.writeByte(addr, val | this.ar);
    }

    /* Bit */
    bit(readFn: ReadFn) {
        var val = readFn();
        this.setFlag(flags.Z, (val & this.ar) === 0);
        this.setFlag(flags.N, !!(val & 0x80));
        this.setFlag(flags.V, !!(val & 0x40));
    }

    /* Bit Immediate*/
    bitI(readFn: ReadFn) {
        var val = readFn();
        this.setFlag(flags.Z, (val & this.ar) === 0);
    }

    private compare(a: byte, b: byte) {
        b = (b ^ 0xff);
        var c = a + b + 1;
        this.setFlag(flags.C, c > 0xff);
        this.testNZ(c & 0xff);
    }

    cmp(readFn: ReadFn) {
        this.compare(this.ar, readFn());
    }

    cpx(readFn: ReadFn) {
        this.compare(this.xr, readFn());
    }

    cpy(readFn: ReadFn) {
        this.compare(this.yr, readFn());
    }

    /* Branches */
    brs(f: flag) {
        let off = this.readBytePC(); // changes pc
        if ((f & this.sr) !== 0) {
            this.readByte(this.pc);
            let oldPage = this.pc >> 8;
            this.pc += off > 127 ? off - 256 : off;
            let newPage = this.pc >> 8;
            let newOff = this.pc & 0xff;
            if (newPage != oldPage) this.readByte(oldPage << 8 | newOff);
        }
    }

    brc(f: flag) {
        let off = this.readBytePC(); // changes pc
        if ((f & this.sr) === 0) {
            this.readByte(this.pc);
            let oldPage = this.pc >> 8;
            this.pc += off > 127 ? off - 256 : off;
            let newPage = this.pc >> 8;
            let newOff = this.pc & 0xff;
            if (newPage != oldPage) this.readByte(oldPage << 8 | newOff);
        }
    }

    /* WDC 65C02 branches */

    bbr(b: flag) {
        let zpAddr = this.readBytePC();
        let val = this.readByte(zpAddr);
        this.readByte(zpAddr);
        let off = this.readBytePC(); // changes pc

        if (((1 << b) & val) === 0) {
            let oldPc = this.pc;
            let oldPage = oldPc >> 8;
            this.readByte(oldPc);
            this.pc += off > 127 ? off - 256 : off;
            let newPage = this.pc >> 8;
            if (oldPage != newPage) {
                this.readByte(oldPc);
            }
        }
    }

    bbs(b: flag) {
        let zpAddr = this.readBytePC();
        let val = this.readByte(zpAddr);
        this.readByte(zpAddr);
        let off = this.readBytePC(); // changes pc

        if (((1 << b) & val) !== 0) {
            let oldPc = this.pc;
            let oldPage = oldPc >> 8;
            this.readByte(oldPc);
            this.pc += off > 127 ? off - 256 : off;
            let newPage = this.pc >> 8;
            if (oldPage != newPage) {
                this.readByte(oldPc);
            }
        }
    }

    /* Transfers and stack */
    tax() { this.readByte(this.pc); this.testNZ(this.xr = this.ar); }

    txa() { this.readByte(this.pc); this.testNZ(this.ar = this.xr); }

    tay() { this.readByte(this.pc); this.testNZ(this.yr = this.ar); }
    
    tya() { this.readByte(this.pc); this.testNZ(this.ar = this.yr); }

    tsx() { this.readByte(this.pc); this.testNZ(this.xr = this.sp); }

    txs() { this.readByte(this.pc); this.sp = this.xr; }

    pha() { this.readByte(this.pc); this.pushByte(this.ar); }

    pla() { this.readByte(this.pc); this.readByte(0x0100 | this.sp); this.testNZ(this.ar = this.pullByte()); }

    phx() { this.readByte(this.pc); this.pushByte(this.xr); }

    plx() { this.readByte(this.pc); this.readByte(0x0100 | this.sp);this.testNZ(this.xr = this.pullByte()); }

    phy() { this.readByte(this.pc); this.pushByte(this.yr); }

    ply() { this.readByte(this.pc); this.readByte(0x0100 | this.sp); this.testNZ(this.yr = this.pullByte()); }

    php() { this.readByte(this.pc); this.pushByte(this.sr | flags.B); }

    plp() { this.readByte(this.pc); this.readByte(0x0100 | this.sp); this.sr = (this.pullByte() & ~flags.B) | 0x20; }

    /* Jump */
    jmp(readAddrFn: ReadAddrFn) {
        this.pc = readAddrFn();
    }

    /* Jump Subroutine */
    jsr() {
        let lsb = this.readBytePC();
        this.readByte(0x0100 | this.sp);
        this.pushWord(this.pc);
        let msb = this.readBytePC();
        this.pc = (msb << 8 | lsb) & 0xffff;
    }

    /* Return from Subroutine */
    rts() {
        this.readByte(this.pc);
        this.readByte(0x0100 | this.sp);
        let addr = this.pullWordRaw();
        this.readByte(addr);
        this.pc = (addr + 1) & 0xffff;
    }

    /* Return from Interrupt */
    rti() {
        this.readByte(this.pc);
        this.readByte(0x0100 | this.sp);
        this.sr = this.pullByte() & ~flags.B;
        this.pc = this.pullWordRaw();
    }

    /* Set and Clear */
    set(flag: flag) {
        this.readByte(this.pc);
        this.sr |= flag;
    }

    clr(flag: flag) {
        this.readByte(this.pc);
        this.sr &= ~flag;
    }

    /* No-Op */
    nop(readAddrFn: ReadAddrFn) {
        this.readByte(this.pc);
        readAddrFn();
    }

    private unknown(b: byte) {
        let unk: noopInstruction;

        if (this.is65C02) {
            unk = [
                'NOP',
                this.nop,
                this.readImplied,
                modes.implied,
                2
            ];
        } else {
            unk = [
                '???',
                function() {
                    debug('Unknown OpCode: ' + toHex(b) +
                          ' at ' + toHex(this.pc - 1, 4));
                },
                this.readImplied,
                modes.implied,
                1
            ];
        }
        this.ops[b] = unk;
        return unk;
    }

    private dumpArgs(addr: word, m: mode, symbols: symbols) {
        function toHexOrSymbol(v: word, n?: number) {
            if (symbols && symbols[v]) {
                return symbols[v];
            } else {
                return '$' + toHex(v, n);
            }
        }

        let result = '';
        switch (m) {
        case modes.implied:
            break;
        case modes.immediate:
            result = '#' + toHexOrSymbol(this.readByteDebug(addr));
            break;
        case modes.absolute:
            result = '' + toHexOrSymbol(this.readWordDebug(addr), 4);
            break;
        case modes.zeroPage:
            result = '' + toHexOrSymbol(this.readByteDebug(addr));
            break;
        case modes.relative:
            {
                let off = this.readByteDebug(addr);
                if (off > 127) {
                    off -= 256;
                }
                addr += off + 1;
                result = '' + toHexOrSymbol(addr, 4) + ' (' + off + ')';
            }
            break;
        case modes.absoluteX:
            result = '' + toHexOrSymbol(this.readWordDebug(addr), 4) + ',X';
            break;
        case modes.absoluteY:
            result = '' + toHexOrSymbol(this.readWordDebug(addr), 4) + ',Y';
            break;
        case modes.zeroPageX:
            result = '' + toHexOrSymbol(this.readByteDebug(addr)) + ',X';
            break;
        case modes.zeroPageY:
            result = '' + toHexOrSymbol(this.readByteDebug(addr)) + ',Y';
            break;
        case modes.absoluteIndirect:
            result = '(' + toHexOrSymbol(this.readWordDebug(addr), 4) + ')';
            break;
        case modes.zeroPageXIndirect:
            result = '(' + toHexOrSymbol(this.readByteDebug(addr)) + ',X)';
            break;
        case modes.zeroPageIndirectY:
            result = '(' + toHexOrSymbol(this.readByteDebug(addr)) + '),Y';
            break;
        case modes.accumulator:
            result = 'A';
            break;
        case modes.zeroPageIndirect:
            result = '(' + toHexOrSymbol(this.readByteDebug(addr)) + ')';
            break;
        case modes.absoluteXIndirect:
            result = '(' + toHexOrSymbol(this.readWordDebug(addr), 4) + ',X)';
            break;
        case modes.zeroPage_relative:
            let val = this.readByteDebug(addr);
            let off = this.readByteDebug(addr + 1);
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

    public step(cb: callback) {
        this.sync = true;
        let op = this.opary[this.readBytePC()];
        this.sync = false;
        op[1](op[2] as any); // TODO(flan): Hack until there is better typing.

        if (cb) {
            cb(this);
        }
    }

    public stepDebug(n: number, cb: callback) {
        for (let idx = 0; idx < n; idx++) {
            this.sync = true;
            let op = this.opary[this.readBytePC()];
            this.sync = false;
            op[1](op[2] as any); // TODO(flan): Hack until there is better typing.

            if (cb) {
                cb(this);
            }
        }
    }

    public stepCycles(c: number) {
        let end = this.cycles + c;

        while (this.cycles < end) {
            this.sync = true;
            let op = this.opary[this.readBytePC()];
            this.sync = false;
            op[1](op[2] as any); // TODO(flan): Hack until there is better typing.
        }
    }

    public stepCyclesDebug(c: number, cb: callback): void {
        var op, end = this.cycles + c;

        while (this.cycles < end) {
            this.sync = true;
            op = this.opary[this.readBytePC()];
            this.sync = false;
            op[1](op[2] as any); // TODO(flan): Hack until there is better typing.

            if (cb) {
                cb(this);
            }
        }
    }

    public addPageHandler(pho: (PageHandler | ResettablePageHandler) & (ReadablePage | WriteablePage)) {
        for (let idx = pho.start(); idx <= pho.end(); idx++) {
            if (isReadablePage(pho))
                this.readPages[idx] = pho;
            if (isWriteablePage(pho))
                this.writePages[idx] = pho;
        }
        if (isResettablePageHandler(pho))
            this.resetHandlers.push(pho);
    }

    public reset() {
        // cycles = 0;
        this.sr = 0x20;
        this.sp = 0xff;
        this.ar = 0;
        this.yr = 0;
        this.xr = 0;
        this.pc = this.readWord(loc.RESET);

        for (let idx = 0; idx < this.resetHandlers.length; idx++) {
            this.resetHandlers[idx].reset();
        }
    }

    /* IRQ - Interrupt Request */
    public irq() {
        if ((this.sr & flags.I) === 0) {
            this.pushWord(this.pc);
            this.pushByte(this.sr & ~flags.B);
            if (this.is65C02) {
                this.setFlag(flags.D, false);
            }
            this.setFlag(flags.I, true);
            this.pc = this.readWord(loc.BRK);
        }
    }

    /* NMI Non-maskable Interrupt */
    public nmi() {
        this.pushWord(this.pc);
        this.pushByte(this.sr & ~flags.B);
        if (this.is65C02) {
            this.setFlag(flags.D, false);
        }
        this.setFlag(flags.I, true);
        this.pc = this.readWord(loc.NMI);
    }

    public getPC() {
        return this.pc;
    }

    public setPC(pc: word) {
        this.pc = pc;
    }

    public dumpPC(pc: word, symbols: symbols) {
        if (pc === undefined) {
            pc = this.pc;
        }
        let b = this.readByte(pc),
            op = this.ops[b],
            size = sizes[op[3]],
            result = toHex(pc, 4) + '- ';

        if (symbols) {
            if (symbols[pc]) {
                result += symbols[pc] +
                    '          '.substring(symbols[pc].length);
            } else {
                result += '          ';
            }
        }

        for (var idx = 0; idx < 4; idx++) {
            if (idx < size) {
                result += toHex(this.readByte(pc + idx)) + ' ';
            } else {
                result += '   ';
            }
        }

        if (op === undefined)
            result += '??? (' + toHex(b) + ')';
        else
            result += op[0] + ' ' + this.dumpArgs(pc + 1, op[3], symbols);

        return result;
    }

    public dumpPage(start?: word, end?: word) {
        var result = '';
        if (start === undefined) {
            start = this.pc >> 8;
        }
        if (end === undefined) {
            end = start;
        }
        for (var page = start; page <= end; page++) {
            var b, idx, jdx;
            for (idx = 0; idx < 16; idx++) {
                result += toHex(page) + toHex(idx << 4) + ': ';
                for (jdx = 0; jdx < 16; jdx++) {
                    b = this.readByteDebug(page * 256 + idx * 16 + jdx);
                    result += toHex(b) + ' ';
                }
                result += '        ';
                for (jdx = 0; jdx < 16; jdx++) {
                    b = this.readByte(page * 256 + idx * 16 + jdx) & 0x7f;
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
    }

    public list(_pc: word, symbols: symbols) {
        if (_pc === undefined) {
            _pc = this.pc;
        }
        var results = [];
        for (var jdx = 0; jdx < 20; jdx++) {
            var b = this.readByte(_pc), op = this.ops[b];
            results.push(this.dumpPC(_pc, symbols));
            _pc += sizes[op[3]];
        }
        return results;
    }

    public sync_() {
        return this.sync;
    }

    public cycles_() {
        return this.cycles;
    }

    public registers() {
            return [this.pc,this.ar,this.xr,this.yr,this.sr,this.sp];
    }

    public getState(): CpuState {
        return {
            a: this.ar,
            x: this.xr,
            y: this.yr,
            s: this.sr,
            pc: this.pc,
            sp: this.sp,
            cycles: this.cycles
        };
    }

    public setState(state: CpuState) {
        this.ar = state.a;
        this.xr = state.x;
        this.yr = state.y;
        this.sr = state.s;
        this.pc = state.pc;
        this.sp = state.sp;
        this.cycles = state.cycles;
    }

    public dumpRegisters() {
        return toHex(this.pc, 4) +
            '-   A=' + toHex(this.ar) +
            ' X=' + toHex(this.xr) +
            ' Y=' + toHex(this.yr) +
            ' P=' + toHex(this.sr) +
            ' S=' + toHex(this.sp) +
            ' ' +
            ((this.sr & flags.N) ? 'N' : '-') +
            ((this.sr & flags.V) ? 'V' : '-') +
            '-' +
            ((this.sr & flags.B) ? 'B' : '-') +
            ((this.sr & flags.D) ? 'D' : '-') +
            ((this.sr & flags.I) ? 'I' : '-') +
            ((this.sr & flags.Z) ? 'Z' : '-') +
            ((this.sr & flags.C) ? 'C' : '-');
    }

    public read(page: byte, off: byte): byte {
        return this.readPages[page].read(page, off);
    }

    public write(page: byte, off: byte, val: byte) {
        this.writePages[page].write(page, off, val);
    }
}

const c = CPU6502.prototype;
const OPS_6502: Instructions = {
    // LDA
    0xa9: ['LDA', c.lda, c.readImmediate, modes.immediate, 2],
    0xa5: ['LDA', c.lda, c.readZeroPage, modes.zeroPage, 3],
    0xb5: ['LDA', c.lda, c.readZeroPageX, modes.zeroPageX, 4],
    0xad: ['LDA', c.lda, c.readAbsolute, modes.absolute, 4],
    0xbd: ['LDA', c.lda, c.readAbsoluteX, modes.absoluteX, 4],
    0xb9: ['LDA', c.lda, c.readAbsoluteY, modes.absoluteY, 4],
    0xa1: ['LDA', c.lda, c.readZeroPageXIndirect, modes.zeroPageXIndirect, 6],
    0xb1: ['LDA', c.lda, c.readZeroPageIndirectY, modes.zeroPageIndirectY, 5],

    // LDX
    0xa2: ['LDX', c.ldx, c.readImmediate, modes.immediate, 2],
    0xa6: ['LDX', c.ldx, c.readZeroPage, modes.zeroPage, 3],
    0xb6: ['LDX', c.ldx, c.readZeroPageY, modes.zeroPageY, 4],
    0xae: ['LDX', c.ldx, c.readAbsolute, modes.absolute, 4],
    0xbe: ['LDX', c.ldx, c.readAbsoluteY, modes.absoluteY, 4],

    // LDY
    0xa0: ['LDY', c.ldy, c.readImmediate, modes.immediate, 2],
    0xa4: ['LDY', c.ldy, c.readZeroPage, modes.zeroPage, 3],
    0xb4: ['LDY', c.ldy, c.readZeroPageX, modes.zeroPageX, 4],
    0xac: ['LDY', c.ldy, c.readAbsolute, modes.absolute, 4],
    0xbc: ['LDY', c.ldy, c.readAbsoluteX, modes.absoluteX, 4],

    // STA
    0x85: ['STA', c.sta, c.writeZeroPage, modes.zeroPage, 3],
    0x95: ['STA', c.sta, c.writeZeroPageX, modes.zeroPageX, 4],
    0x8d: ['STA', c.sta, c.writeAbsolute, modes.absolute, 4],
    0x9d: ['STA', c.sta, c.writeAbsoluteX, modes.absoluteX, 5],
    0x99: ['STA', c.sta, c.writeAbsoluteY, modes.absoluteY, 5],
    0x81: ['STA', c.sta, c.writeZeroPageXIndirect, modes.zeroPageXIndirect, 6],
    0x91: ['STA', c.sta, c.writeZeroPageIndirectY, modes.zeroPageIndirectY, 6],

    // STX
    0x86: ['STX', c.stx, c.writeZeroPage, modes.zeroPage, 3],
    0x96: ['STX', c.stx, c.writeZeroPageY, modes.zeroPageY, 4],
    0x8e: ['STX', c.stx, c.writeAbsolute, modes.absolute, 4],

    // STY
    0x84: ['STY', c.sty, c.writeZeroPage, modes.zeroPage, 3],
    0x94: ['STY', c.sty, c.writeZeroPageX, modes.zeroPageX, 4],
    0x8c: ['STY', c.sty, c.writeAbsolute, modes.absolute, 4],

    // ADC
    0x69: ['ADC', c.adc, c.readImmediate, modes.immediate, 2],
    0x65: ['ADC', c.adc, c.readZeroPage, modes.zeroPage, 3],
    0x75: ['ADC', c.adc, c.readZeroPageX, modes.zeroPageX, 4],
    0x6D: ['ADC', c.adc, c.readAbsolute, modes.absolute, 4],
    0x7D: ['ADC', c.adc, c.readAbsoluteX, modes.absoluteX, 4],
    0x79: ['ADC', c.adc, c.readAbsoluteY, modes.absoluteY, 4],
    0x61: ['ADC', c.adc, c.readZeroPageXIndirect, modes.zeroPageXIndirect, 6],
    0x71: ['ADC', c.adc, c.readZeroPageIndirectY, modes.zeroPageIndirectY, 5],

    // SBC
    0xe9: ['SBC', c.sbc, c.readImmediate, modes.immediate, 2],
    0xe5: ['SBC', c.sbc, c.readZeroPage, modes.zeroPage, 3],
    0xf5: ['SBC', c.sbc, c.readZeroPageX, modes.zeroPageX, 4],
    0xeD: ['SBC', c.sbc, c.readAbsolute, modes.absolute, 4],
    0xfD: ['SBC', c.sbc, c.readAbsoluteX, modes.absoluteX, 4],
    0xf9: ['SBC', c.sbc, c.readAbsoluteY, modes.absoluteY, 4],
    0xe1: ['SBC', c.sbc, c.readZeroPageXIndirect, modes.zeroPageXIndirect, 6],
    0xf1: ['SBC', c.sbc, c.readZeroPageIndirectY, modes.zeroPageIndirectY, 5],

    // INC
    0xe6: ['INC', c.inc, c.readAddrZeroPage, modes.zeroPage, 5],
    0xf6: ['INC', c.inc, c.readAddrZeroPageX, modes.zeroPageX, 6],
    0xee: ['INC', c.inc, c.readAddrAbsolute, modes.absolute, 6],
    0xfe: ['INC', c.inc, c.readAddrAbsoluteX, modes.absoluteX, 7],

    // INX
    0xe8: ['INX', c.inx, null, modes.implied, 2],

    // INY
    0xc8: ['INY', c.iny, null, modes.implied, 2],

    // DEC
    0xc6: ['DEC', c.dec, c.readAddrZeroPage, modes.zeroPage, 5],
    0xd6: ['DEC', c.dec, c.readAddrZeroPageX, modes.zeroPageX, 6],
    0xce: ['DEC', c.dec, c.readAddrAbsolute, modes.absolute, 6],
    0xde: ['DEC', c.dec, c.readAddrAbsoluteX, modes.absoluteX, 7],

    // DEX
    0xca: ['DEX', c.dex, null, modes.implied, 2],

    // DEY
    0x88: ['DEY', c.dey, null, modes.implied, 2],

    // ASL
    0x0A: ['ASL', c.aslA, null, modes.accumulator, 2],
    0x06: ['ASL', c.asl, c.readAddrZeroPage, modes.zeroPage, 5],
    0x16: ['ASL', c.asl, c.readAddrZeroPageX, modes.zeroPageX, 6],
    0x0E: ['ASL', c.asl, c.readAddrAbsolute, modes.absolute, 6],
    0x1E: ['ASL', c.asl, c.readAddrAbsoluteX, modes.absoluteX, 7],

    // LSR
    0x4A: ['LSR', c.lsrA, null, modes.accumulator, 2],
    0x46: ['LSR', c.lsr, c.readAddrZeroPage, modes.zeroPage, 5],
    0x56: ['LSR', c.lsr, c.readAddrZeroPageX, modes.zeroPageX, 6],
    0x4E: ['LSR', c.lsr, c.readAddrAbsolute, modes.absolute, 6],
    0x5E: ['LSR', c.lsr, c.readAddrAbsoluteX, modes.absoluteX, 7],

    // ROL
    0x2A: ['ROL', c.rolA, null, modes.accumulator, 2],
    0x26: ['ROL', c.rol, c.readAddrZeroPage, modes.zeroPage, 5],
    0x36: ['ROL', c.rol, c.readAddrZeroPageX, modes.zeroPageX, 6],
    0x2E: ['ROL', c.rol, c.readAddrAbsolute, modes.absolute, 6],
    0x3E: ['ROL', c.rol, c.readAddrAbsoluteX, modes.absoluteX, 7],

    // ROR
    0x6A: ['ROR', c.rorA, null, modes.accumulator, 2],
    0x66: ['ROR', c.ror, c.readAddrZeroPage, modes.zeroPage, 5],
    0x76: ['ROR', c.ror, c.readAddrZeroPageX, modes.zeroPageX, 6],
    0x6E: ['ROR', c.ror, c.readAddrAbsolute, modes.absolute, 6],
    0x7E: ['ROR', c.ror, c.readAddrAbsoluteX, modes.absoluteX, 7],

    // AND
    0x29: ['AND', c.and, c.readImmediate, modes.immediate, 2],
    0x25: ['AND', c.and, c.readZeroPage, modes.zeroPage, 3],
    0x35: ['AND', c.and, c.readZeroPageX, modes.zeroPageX, 4],
    0x2D: ['AND', c.and, c.readAbsolute, modes.absolute, 4],
    0x3D: ['AND', c.and, c.readAbsoluteX, modes.absoluteX, 4],
    0x39: ['AND', c.and, c.readAbsoluteY, modes.absoluteY, 4],
    0x21: ['AND', c.and, c.readZeroPageXIndirect, modes.zeroPageXIndirect, 6],
    0x31: ['AND', c.and, c.readZeroPageIndirectY, modes.zeroPageIndirectY, 5],

    // ORA
    0x09: ['ORA', c.ora, c.readImmediate, modes.immediate, 2],
    0x05: ['ORA', c.ora, c.readZeroPage, modes.zeroPage, 3],
    0x15: ['ORA', c.ora, c.readZeroPageX, modes.zeroPageX, 4],
    0x0D: ['ORA', c.ora, c.readAbsolute, modes.absolute, 4],
    0x1D: ['ORA', c.ora, c.readAbsoluteX, modes.absoluteX, 4],
    0x19: ['ORA', c.ora, c.readAbsoluteY, modes.absoluteY, 4],
    0x01: ['ORA', c.ora, c.readZeroPageXIndirect, modes.zeroPageXIndirect, 6],
    0x11: ['ORA', c.ora, c.readZeroPageIndirectY, modes.zeroPageIndirectY, 5],

    // EOR
    0x49: ['EOR', c.eor, c.readImmediate, modes.immediate, 2],
    0x45: ['EOR', c.eor, c.readZeroPage, modes.zeroPage, 3],
    0x55: ['EOR', c.eor, c.readZeroPageX, modes.zeroPageX, 4],
    0x4D: ['EOR', c.eor, c.readAbsolute, modes.absolute, 4],
    0x5D: ['EOR', c.eor, c.readAbsoluteX, modes.absoluteX, 4],
    0x59: ['EOR', c.eor, c.readAbsoluteY, modes.absoluteY, 4],
    0x41: ['EOR', c.eor, c.readZeroPageXIndirect, modes.zeroPageXIndirect, 6],
    0x51: ['EOR', c.eor, c.readZeroPageIndirectY, modes.zeroPageIndirectY, 5],

    // CMP
    0xc9: ['CMP', c.cmp, c.readImmediate, modes.immediate, 2],
    0xc5: ['CMP', c.cmp, c.readZeroPage, modes.zeroPage, 3],
    0xd5: ['CMP', c.cmp, c.readZeroPageX, modes.zeroPageX, 4],
    0xcD: ['CMP', c.cmp, c.readAbsolute, modes.absolute, 4],
    0xdD: ['CMP', c.cmp, c.readAbsoluteX, modes.absoluteX, 4],
    0xd9: ['CMP', c.cmp, c.readAbsoluteY, modes.absoluteY, 4],
    0xc1: ['CMP', c.cmp, c.readZeroPageXIndirect, modes.zeroPageXIndirect, 6],
    0xd1: ['CMP', c.cmp, c.readZeroPageIndirectY, modes.zeroPageIndirectY, 5],

    // CPX
    0xE0: ['CPX', c.cpx, c.readImmediate, modes.immediate, 2],
    0xE4: ['CPX', c.cpx, c.readZeroPage, modes.zeroPage, 3],
    0xEC: ['CPX', c.cpx, c.readAbsolute, modes.absolute, 4],

    // CPY
    0xC0: ['CPY', c.cpy, c.readImmediate, modes.immediate, 2],
    0xC4: ['CPY', c.cpy, c.readZeroPage, modes.zeroPage, 3],
    0xCC: ['CPY', c.cpy, c.readAbsolute, modes.absolute, 4],

    // BIT
    0x24: ['BIT', c.bit, c.readZeroPage, modes.zeroPage, 3],
    0x2C: ['BIT', c.bit, c.readAbsolute, modes.absolute, 4],

    // BCC
    0x90: ['BCC', c.brc, flags.C, modes.relative, 2],

    // BCS
    0xB0: ['BCS', c.brs, flags.C, modes.relative, 2],

    // BEQ
    0xF0: ['BEQ', c.brs, flags.Z, modes.relative, 2],

    // BMI
    0x30: ['BMI', c.brs, flags.N, modes.relative, 2],

    // BNE
    0xD0: ['BNE', c.brc, flags.Z, modes.relative, 2],

    // BPL
    0x10: ['BPL', c.brc, flags.N, modes.relative, 2],

    // BVC
    0x50: ['BVC', c.brc, flags.V, modes.relative, 2],

    // BVS
    0x70: ['BVS', c.brs, flags.V, modes.relative, 2],

    // TAX
    0xAA: ['TAX', c.tax, null, modes.implied, 2],

    // TXA
    0x8A: ['TXA', c.txa, null, modes.implied, 2],

    // TAY
    0xA8: ['TAY', c.tay, null, modes.implied, 2],

    // TYA
    0x98: ['TYA', c.tya, null, modes.implied, 2],

    // TSX
    0xBA: ['TSX', c.tsx, null, modes.implied, 2],

    // TXS
    0x9A: ['TXS', c.txs, null, modes.implied, 2],

    // PHA
    0x48: ['PHA', c.pha, null, modes.implied, 3],

    // PLA
    0x68: ['PLA', c.pla, null, modes.implied, 4],

    // PHP
    0x08: ['PHP', c.php, null, modes.implied, 3],

    // PLP
    0x28: ['PLP', c.plp, null, modes.implied, 4],

    // JMP
    0x4C: [
        'JMP', c.jmp, c.readAddrAbsolute, modes.absolute, 3
    ],
    0x6C: [
        'JMP', c.jmp, c.readAddrAbsoluteIndirectBug, modes.absoluteIndirect, 5
    ],
    // JSR
    0x20: ['JSR', c.jsr, c.readAddrAbsolute, modes.absolute, 6],

    // RTS
    0x60: ['RTS', c.rts, null, modes.implied, 6],

    // RTI
    0x40: ['RTI', c.rti, null, modes.implied, 6],

    // SEC
    0x38: ['SEC', c.set, flags.C, modes.implied, 2],

    // SED
    0xF8: ['SED', c.set, flags.D, modes.implied, 2],

    // SEI
    0x78: ['SEI', c.set, flags.I, modes.implied, 2],

    // CLC
    0x18: ['CLC', c.clr, flags.C, modes.implied, 2],

    // CLD
    0xD8: ['CLD', c.clr, flags.D, modes.implied, 2],

    // CLI
    0x58: ['CLI', c.clr, flags.I, modes.implied, 2],

    // CLV
    0xB8: ['CLV', c.clr, flags.V, modes.implied, 2],

    // NOP
    0xea: ['NOP', c.nop, c.readImplied, modes.implied, 2],

    // BRK
    0x00: ['BRK', c.brk, c.readImmediate, modes.immediate, 7]
};

/* 65C02 Instructions */

const OPS_65C02: Instructions = {
    // INC / DEC A
    0x1A: ['INC', c.incA, null, modes.accumulator, 2],
    0x3A: ['DEC', c.decA, null, modes.accumulator, 2],

    // Indirect Zero Page for the masses
    0x12: ['ORA', c.ora, c.readZeroPageIndirect, modes.zeroPageIndirect, 5],
    0x32: ['AND', c.and, c.readZeroPageIndirect, modes.zeroPageIndirect, 5],
    0x52: ['EOR', c.eor, c.readZeroPageIndirect, modes.zeroPageIndirect, 5],
    0x72: ['ADC', c.adc, c.readZeroPageIndirect, modes.zeroPageIndirect, 5],
    0x92: ['STA', c.sta, c.writeZeroPageIndirect, modes.zeroPageIndirect, 5],
    0xB2: ['LDA', c.lda, c.readZeroPageIndirect, modes.zeroPageIndirect, 5],
    0xD2: ['CMP', c.cmp, c.readZeroPageIndirect, modes.zeroPageIndirect, 5],
    0xF2: ['SBC', c.sbc, c.readZeroPageIndirect, modes.zeroPageIndirect, 5],

    // Better BIT
    0x34: ['BIT', c.bit, c.readZeroPageX, modes.zeroPageX, 4],
    0x3C: ['BIT', c.bit, c.readAbsoluteX, modes.absoluteX, 4],
    0x89: ['BIT', c.bitI, c.readImmediate, modes.immediate, 2],

    // JMP absolute indirect indexed
    0x6C: [
        'JMP', c.jmp, c.readAddrAbsoluteIndirect, modes.absoluteIndirect, 6
    ],
    0x7C: [
        'JMP', c.jmp, c.readAddrAbsoluteXIndirect, modes.absoluteXIndirect, 6
    ],

    // BBR/BBS
    0x0F: ['BBR0', c.bbr, 0, modes.zeroPage_relative, 5],
    0x1F: ['BBR1', c.bbr, 1, modes.zeroPage_relative, 5],
    0x2F: ['BBR2', c.bbr, 2, modes.zeroPage_relative, 5],
    0x3F: ['BBR3', c.bbr, 3, modes.zeroPage_relative, 5],
    0x4F: ['BBR4', c.bbr, 4, modes.zeroPage_relative, 5],
    0x5F: ['BBR5', c.bbr, 5, modes.zeroPage_relative, 5],
    0x6F: ['BBR6', c.bbr, 6, modes.zeroPage_relative, 5],
    0x7F: ['BBR7', c.bbr, 7, modes.zeroPage_relative, 5],

    0x8F: ['BBS0', c.bbs, 0, modes.zeroPage_relative, 5],
    0x9F: ['BBS1', c.bbs, 1, modes.zeroPage_relative, 5],
    0xAF: ['BBS2', c.bbs, 2, modes.zeroPage_relative, 5],
    0xBF: ['BBS3', c.bbs, 3, modes.zeroPage_relative, 5],
    0xCF: ['BBS4', c.bbs, 4, modes.zeroPage_relative, 5],
    0xDF: ['BBS5', c.bbs, 5, modes.zeroPage_relative, 5],
    0xEF: ['BBS6', c.bbs, 6, modes.zeroPage_relative, 5],
    0xFF: ['BBS7', c.bbs, 7, modes.zeroPage_relative, 5],

    // BRA
    0x80: ['BRA', c.brc, 0, modes.relative, 2],

    // NOP
    0x02: ['NOP', c.nop, c.readImmediate, modes.immediate, 2],
    0x22: ['NOP', c.nop, c.readImmediate, modes.immediate, 2],
    0x42: ['NOP', c.nop, c.readImmediate, modes.immediate, 2],
    0x44: ['NOP', c.nop, c.readImmediate, modes.immediate, 3],
    0x54: ['NOP', c.nop, c.readImmediate, modes.immediate, 4],
    0x62: ['NOP', c.nop, c.readImmediate, modes.immediate, 2],
    0x82: ['NOP', c.nop, c.readImmediate, modes.immediate, 2],
    0xC2: ['NOP', c.nop, c.readImmediate, modes.immediate, 2],
    0xD4: ['NOP', c.nop, c.readImmediate, modes.immediate, 4],
    0xE2: ['NOP', c.nop, c.readImmediate, modes.immediate, 2],
    0xF4: ['NOP', c.nop, c.readImmediate, modes.immediate, 4],
    0x5C: ['NOP', c.nop, c.readAbsolute, modes.absolute, 8],
    0xDC: ['NOP', c.nop, c.readAbsolute, modes.absolute, 4],
    0xFC: ['NOP', c.nop, c.readAbsolute, modes.absolute, 4],

    // PHX
    0xDA: ['PHX', c.phx, null, modes.implied, 3],

    // PHY
    0x5A: ['PHY', c.phy, null, modes.implied, 3],

    // PLX
    0xFA: ['PLX', c.plx, null, modes.implied, 4],

    // PLY
    0x7A: ['PLY', c.ply, null, modes.implied, 4],

    // RMB/SMB

    0x07: ['RMB0', c.rmb, 0, modes.zeroPage, 5],
    0x17: ['RMB1', c.rmb, 1, modes.zeroPage, 5],
    0x27: ['RMB2', c.rmb, 2, modes.zeroPage, 5],
    0x37: ['RMB3', c.rmb, 3, modes.zeroPage, 5],
    0x47: ['RMB4', c.rmb, 4, modes.zeroPage, 5],
    0x57: ['RMB5', c.rmb, 5, modes.zeroPage, 5],
    0x67: ['RMB6', c.rmb, 6, modes.zeroPage, 5],
    0x77: ['RMB7', c.rmb, 7, modes.zeroPage, 5],

    0x87: ['SMB0', c.smb, 0, modes.zeroPage, 5],
    0x97: ['SMB1', c.smb, 1, modes.zeroPage, 5],
    0xA7: ['SMB2', c.smb, 2, modes.zeroPage, 5],
    0xB7: ['SMB3', c.smb, 3, modes.zeroPage, 5],
    0xC7: ['SMB4', c.smb, 4, modes.zeroPage, 5],
    0xD7: ['SMB5', c.smb, 5, modes.zeroPage, 5],
    0xE7: ['SMB6', c.smb, 6, modes.zeroPage, 5],
    0xF7: ['SMB7', c.smb, 7, modes.zeroPage, 5],

    // STZ
    0x64: ['STZ', c.stz, c.writeZeroPage, modes.zeroPage, 3],
    0x74: ['STZ', c.stz, c.writeZeroPageX, modes.zeroPageX, 4],
    0x9C: ['STZ', c.stz, c.writeAbsolute, modes.absolute, 4],
    0x9E: ['STZ', c.stz, c.writeAbsoluteX, modes.absoluteX, 5],

    // TRB
    0x14: ['TRB', c.trb, c.readAddrZeroPage, modes.zeroPage, 5],
    0x1C: ['TRB', c.trb, c.readAddrAbsolute, modes.absolute, 6],

    // TSB
    0x04: ['TSB', c.tsb, c.readAddrZeroPage, modes.zeroPage, 5],
    0x0C: ['TSB', c.tsb, c.readAddrAbsolute, modes.absolute, 6]
};
