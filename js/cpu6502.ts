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

type Modes = { [key: string]: number }
type Mode = keyof Modes

/** Addressing mode name to number mapping. */
const modes: Modes = {
    accumulator: 1,           // A (Accumulator)
    implied:     1,           // Implied
    immediate:   2,           // # Immediate
    absolute:    3,           // a Absolute
    zeroPage:    2,           // zp Zero Page
    relative:    2,           // r Relative

    absoluteX:   3,           // a,X Absolute, X
    absoluteY:   3,           // a,Y Absolute, Y
    zeroPageX:   2,           // zp,X Zero Page, X
    zeroPageY:   2,           // zp,Y Zero Page, Y

    absoluteIndirect:   3,  // (a) Indirect
    zeroPageXIndirect:  2, // (zp,X) Zero Page Indexed Indirect
    zeroPageIndirectY:  2, // (zp),Y Zero Page Indexed with Y

    /* 65c02 */
    zeroPageIndirect:   2,  // (zp),
    absoluteXIndirect:  3,  // (a, X),
    zeroPage_relative:  3   // zp, Relative
};

/** Status register flag numbers. */
type flag = 0x80 | 0x40 | 0x20 | 0x10 | 0x08 | 0x04 | 0x02 | 0x01;

/** Flags to status byte mask. */
const flags: {[key: string]: flag} = {
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

export interface ReadablePage {
    read(page: byte, offset: byte): byte;
}

function isReadablePage(page: ReadablePage | any): page is ReadablePage {
    return (page as ReadablePage).read !== undefined;
}

export interface WriteablePage {
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
type ImpliedFn = () => void

interface Op<T> {
    name: string
    mode: keyof Modes
    op: (fn: T) => void
    modeFn: T
}

type Instruction = Op<ReadFn | WriteFn | ReadAddrFn | ImpliedFn | number>

interface Instructions {
    [key: number]: Instruction;
}

type callback = (cpu: any) => void; // TODO(flan): Hack until there is better typing.

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
    private readonly opary: Instruction[];

    constructor(options: CpuOptions = {}) {
        this.is65C02 = options['65C02'] ? true : false;

        for (let idx = 0; idx < 0x100; idx++) {
            this.readPages[idx] = BLANK_PAGE;
            this.writePages[idx] = BLANK_PAGE;
        }

        // Create this CPU's instruction table

        let ops: Instructions = { ...this.OPS_6502 };
        if (this.is65C02) {
            ops = { ...ops, ...this.OPS_65C02 };
        }
        this.ops = ops;

        // Certain browsers benefit from using arrays over maps
        const opary: Instruction[] = [];

        for (let idx = 0; idx < 0x100; idx++) {
            opary[idx] = ops[idx] || this.unknown(idx)
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
     * Implied function
     */

    implied() {
    }

    /*
     * Read functions
     */

    // #$00
    readImmediate = (): byte => {
        return this.readBytePC();
    }

    // $0000
    readAbsolute = (): byte => {
        return this.readByte(this.readWordPC());
    }

    // $00
    readZeroPage= (): byte => {
        return this.readByte(this.readBytePC());
    }

    // $0000,X
    readAbsoluteX= (): byte => {
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
    readAbsoluteY = (): byte => {
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
    readZeroPageX = (): byte => {
        var zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        return this.readByte((zpAddr + this.xr) & 0xff);
    }

    // $00,Y
    readZeroPageY = (): byte => {
        var zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        return this.readByte((zpAddr + this.yr) & 0xff);
    }

    // ($00,X)
    readZeroPageXIndirect = (): byte => {
        var zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        var addr = this.readZPWord((zpAddr + this.xr) & 0xff);
        return this.readByte(addr);
    }

    // ($00),Y
    readZeroPageIndirectY = (): byte => {
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
    readZeroPageIndirect = (): byte => {
        return this.readByte(this.readZPWord(this.readBytePC()));
    }

    /*
     * Write Functions
     */

    // $0000
    writeAbsolute = (val: byte) => {
        this.writeByte(this.readWordPC(), val);
    }

    // $00
    writeZeroPage = (val: byte) => {
        this.writeByte(this.readBytePC(), val);
    }

    // $0000,X
    writeAbsoluteX = (val: byte) => {
        var addr = this.readWordPC(), oldPage = addr >> 8;
        addr = (addr + this.xr) & 0xffff;
        var off = addr & 0xff;
        this.readByte(oldPage << 8 | off);
        this.writeByte(addr, val);
    }

    // $0000,Y
    writeAbsoluteY = (val: byte) => {
        var addr = this.readWordPC(), oldPage = addr >> 8;
        addr = (addr + this.yr) & 0xffff;
        var off = addr & 0xff;
        this.readByte(oldPage << 8 | off);
        this.writeByte(addr, val);
    }

    // $00,X
    writeZeroPageX = (val: byte) => {
        var zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        this.writeByte((zpAddr + this.xr) & 0xff, val);
    }

    // $00,Y
    writeZeroPageY = (val: byte) => {
        var zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        this.writeByte((zpAddr + this.yr) & 0xff, val);
    }

    // ($00,X)
    writeZeroPageXIndirect = (val: byte) => {
        var zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        var addr = this.readZPWord((zpAddr + this.xr) & 0xff);
        this.writeByte(addr, val);
    }

    // ($00),Y
    writeZeroPageIndirectY = (val: byte) => {
        var addr = this.readZPWord(this.readBytePC()), oldPage = addr >> 8;
        addr = (addr + this.yr) & 0xffff;
        var off = addr & 0xff;
        this.readByte(oldPage << 8 | off);
        this.writeByte(addr, val);
    }

    // ($00) (65C02)
    writeZeroPageIndirect = (val: byte) => {
        this.writeByte(this.readZPWord(this.readBytePC()), val);
    }

    // $00
    readAddrZeroPage = (): byte => {
        return this.readBytePC();
    }

    // $00,X
    readAddrZeroPageX = () => {
        var zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        return (zpAddr + this.xr) & 0xff;
    }

    // $0000 (65C02)
    readAddrAbsolute = (): word => {
        return this.readWordPC();
    }

    // ($0000) (6502)
    readAddrAbsoluteIndirectBug = (): word => {
        var addr = this.readWordPC();
        var page = addr & 0xff00;
        var off = addr & 0x00ff;
        var lsb = this.readByte(addr);
        var msb = this.readByte(page | ((off + 0x01) & 0xff));
        return msb << 8 | lsb;
    }

    // ($0000) (65C02)
    readAddrAbsoluteIndirect = (): word => {
        var lsb = this.readBytePC();
        var msb = this.readBytePC();
        this.readByte(this.pc);
        return this.readWord(msb << 8 | lsb);
    }

    // $0000,X
    readAddrAbsoluteX = (opts: Opts = {}): word => {
        var addr = this.readWordPC();
        if (!this.is65C02 || opts.rwm) {
            this.readByte(addr);
        } else {
            this.readByte(this.pc);
        }
        return (addr + this.xr) & 0xffff;
    }

    // $(0000,X) (65C02)
    readAddrAbsoluteXIndirect = (): word => {
        var address = this.readWordPC();
        this.readByte(this.pc);
        return this.readWord((address + this.xr) & 0xffff);
    }

    /* Break */
    brk = (readFn: ReadFn) => {
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
    lda = (readFn: ReadFn) => {
        this.ar = this.testNZ(readFn());
    }

    /* Load X Register */
    ldx = (readFn: ReadFn) => {
        this.xr = this.testNZ(readFn());
    }

    /* Load Y Register */
    ldy = (readFn: ReadFn) => {
        this.yr = this.testNZ(readFn());
    }

    /* Store Accumulator */
    sta = (writeFn: WriteFn) => {
        writeFn(this.ar);
    }

    /* Store X Register */
    stx = (writeFn: WriteFn) => {
        writeFn(this.xr);
    }

    /* Store Y Register */
    sty = (writeFn: WriteFn) => {
        writeFn(this.yr);
    }

    /* Store Zero */
    stz = (writeFn: WriteFn) => {
        writeFn(0);
    }

    /* Add with Carry */
    adc = (readFn: ReadFn) => {
        this.ar = this.add(this.ar, readFn(), /* sub= */ false);
    }

    /* Subtract with Carry */
    sbc = (readFn: ReadFn) => {
        this.ar = this.add(this.ar, readFn(), /* sub= */ true);
    }

    /* Increment Memory */
    incA = () => {
        this.readByte(this.pc);
        this.ar = this.increment(this.ar);
    }

    inc = (readAddrFn: ReadAddrFn) => {
        var addr = readAddrFn({rwm: true});
        var oldVal = this.readByte(addr);
        this.writeByte(addr, oldVal);
        var val = this.increment(oldVal);
        this.writeByte(addr, val);
    }

    /* Increment X */
    inx = () => {
        this.readByte(this.pc);
        this.xr = this.increment(this.xr);
    }

    /* Increment Y */
    iny = () => {
        this.readByte(this.pc);
        this.yr = this.increment(this.yr);
    }

    /* Decrement Memory */
    decA = () => {
        this.readByte(this.pc);
        this.ar = this.decrement(this.ar);
    }

    dec = (readAddrFn: ReadAddrFn) => {
        var addr = readAddrFn({rwm: true});
        var oldVal = this.readByte(addr);
        this.writeByte(addr, oldVal);
        var val = this.decrement(oldVal);
        this.writeByte(addr, val);
    }

    /* Decrement X */
    dex = () => {
        this.readByte(this.pc);
        this.xr = this.decrement(this.xr);
    }

    /* Decrement Y */
    dey = () => {
        this.readByte(this.pc);
        this.yr = this.decrement(this.yr);
    }

    shiftLeft = (val: byte) => {
        this.setFlag(flags.C, !!(val & 0x80));
        return this.testNZ((val << 1) & 0xff);
    }

    /* Arithmetic Shift Left */
    aslA = () => {
        this.readByte(this.pc);
        this.ar = this.shiftLeft(this.ar);
    }

    asl = (readAddrFn: ReadAddrFn) => {
        var addr = readAddrFn({rwm: true});
        var oldVal = this.readByte(addr);
        this.writeByte(addr, oldVal);
        var val = this.shiftLeft(oldVal);
        this.writeByte(addr, val);
    }

    shiftRight = (val: byte) => {
        this.setFlag(flags.C, !!(val & 0x01));
        return this.testNZ(val >> 1);
    }

    /* Logical Shift Right */
    lsrA = () => {
        this.readByte(this.pc);
        this.ar = this.shiftRight(this.ar);
    }

    lsr = (readAddrFn: ReadAddrFn) => {
        var addr = readAddrFn({rwm: true});
        var oldVal = this.readByte(addr);
        this.writeByte(addr, oldVal);
        var val = this.shiftRight(oldVal);
        this.writeByte(addr, val);
    }

    rotateLeft = (val: byte) => {
        var c = (this.sr & flags.C);
        this.setFlag(flags.C, !!(val & 0x80));
        return this.testNZ(((val << 1) | (c ? 0x01 : 0x00)) & 0xff);
    }

    /* Rotate Left */
    rolA = () => {
        this.readByte(this.pc);
        this.ar = this.rotateLeft(this.ar);
    }

    rol = (readAddrFn: ReadAddrFn) => {
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
    rorA = () => {
        this.readByte(this.pc);
        this.ar = this.rotateRight(this.ar);
    }

    ror = (readAddrFn: ReadAddrFn) => {
        var addr = readAddrFn({rwm: true});
        var oldVal = this.readByte(addr);
        this.writeByte(addr, oldVal);
        var val = this.rotateRight(oldVal);
        this.writeByte(addr, val);
    }

    /* Logical And Accumulator */
    and = (readFn: ReadFn) => {
        this.ar = this.testNZ(this.ar & readFn());
    }

    /* Logical Or Accumulator */
    ora = (readFn: ReadFn) => {
        this.ar = this.testNZ(this.ar | readFn());
    }

    /* Logical Exclusive Or Accumulator */
    eor = (readFn: ReadFn) => {
        this.ar = this.testNZ(this.ar ^ readFn());
    }

    /* Reset Bit */

    rmb = (b: byte) => {
        var bit = (0x1 << b) ^ 0xFF;
        var addr = this.readBytePC();
        var val = this.readByte(addr);
        this.readByte(addr);
        val &= bit;
        this.writeByte(addr, val);
    }

    /* Set Bit */

    smb = (b: byte) => {
        var bit = 0x1 << b;
        var addr = this.readBytePC();
        var val = this.readByte(addr);
        this.readByte(addr);
        val |= bit;
        this.writeByte(addr, val);
    }

    /* Test and Reset Bits */
    trb = (readAddrFn: ReadAddrFn) => {
        var addr = readAddrFn();
        var val = this.readByte(addr);
        this.testZ(val & this.ar);
        this.readByte(addr);
        this.writeByte(addr, val & ~this.ar);
    }

    /* Test and Set Bits */
    tsb = (readAddrFn: ReadAddrFn) => {
        var addr = readAddrFn();
        var val = this.readByte(addr);
        this.testZ(val & this.ar);
        this.readByte(addr);
        this.writeByte(addr, val | this.ar);
    }

    /* Bit */
    bit = (readFn: ReadFn) => {
        var val = readFn();
        this.setFlag(flags.Z, (val & this.ar) === 0);
        this.setFlag(flags.N, !!(val & 0x80));
        this.setFlag(flags.V, !!(val & 0x40));
    }

    /* Bit Immediate*/
    bitI = (readFn: ReadFn) => {
        var val = readFn();
        this.setFlag(flags.Z, (val & this.ar) === 0);
    }

    private compare(a: byte, b: byte) {
        b = (b ^ 0xff);
        var c = a + b + 1;
        this.setFlag(flags.C, c > 0xff);
        this.testNZ(c & 0xff);
    }

    cmp = (readFn: ReadFn) => {
        this.compare(this.ar, readFn());
    }

    cpx = (readFn: ReadFn) => {
        this.compare(this.xr, readFn());
    }

    cpy = (readFn: ReadFn) => {
        this.compare(this.yr, readFn());
    }

    /* Branches */
    brs = (f: flag) => {
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

    brc = (f: flag) => {
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

    bbr = (b: flag) => {
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

    bbs = (b: flag) => {
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
    tax = () => { this.readByte(this.pc); this.testNZ(this.xr = this.ar); }

    txa = () => { this.readByte(this.pc); this.testNZ(this.ar = this.xr); }

    tay = () => { this.readByte(this.pc); this.testNZ(this.yr = this.ar); }

    tya = () => { this.readByte(this.pc); this.testNZ(this.ar = this.yr); }

    tsx = () => { this.readByte(this.pc); this.testNZ(this.xr = this.sp); }

    txs = () => { this.readByte(this.pc); this.sp = this.xr; }

    pha = () => { this.readByte(this.pc); this.pushByte(this.ar); }

    pla = () => { this.readByte(this.pc); this.readByte(0x0100 | this.sp); this.testNZ(this.ar = this.pullByte()); }

    phx = () => { this.readByte(this.pc); this.pushByte(this.xr); }

    plx = () => { this.readByte(this.pc); this.readByte(0x0100 | this.sp);this.testNZ(this.xr = this.pullByte()); }

    phy = () => { this.readByte(this.pc); this.pushByte(this.yr); }

    ply = () => { this.readByte(this.pc); this.readByte(0x0100 | this.sp); this.testNZ(this.yr = this.pullByte()); }

    php = () => { this.readByte(this.pc); this.pushByte(this.sr | flags.B); }

    plp = () => { this.readByte(this.pc); this.readByte(0x0100 | this.sp); this.sr = (this.pullByte() & ~flags.B) | 0x20; }

    /* Jump */
    jmp = (readAddrFn: ReadAddrFn) => {
        this.pc = readAddrFn();
    }

    /* Jump Subroutine */
    jsr = () => {
        let lsb = this.readBytePC();
        this.readByte(0x0100 | this.sp);
        this.pushWord(this.pc);
        let msb = this.readBytePC();
        this.pc = (msb << 8 | lsb) & 0xffff;
    }

    /* Return from Subroutine */
    rts = () => {
        this.readByte(this.pc);
        this.readByte(0x0100 | this.sp);
        let addr = this.pullWordRaw();
        this.readByte(addr);
        this.pc = (addr + 1) & 0xffff;
    }

    /* Return from Interrupt */
    rti = () => {
        this.readByte(this.pc);
        this.readByte(0x0100 | this.sp);
        this.sr = this.pullByte() & ~flags.B;
        this.pc = this.pullWordRaw();
    }

    /* Set and Clear */
    set = (flag: flag) => {
        this.readByte(this.pc);
        this.sr |= flag;
    }

    clr = (flag: flag) => {
        this.readByte(this.pc);
        this.sr &= ~flag;
    }

    /* No-Op */
    nop = (readAddrFn: ReadAddrFn) => {
        this.readByte(this.pc);
        readAddrFn();
    }

    private unknown(b: byte) {
        let unk: Instruction;

        if (this.is65C02) {
            unk = {
                name: 'NOP',
                op: this.nop,
                modeFn: this.implied,
                mode: modes.implied,
            }
        } else {
            unk = {
                name: '???',
                op: function() {
                debug('Unknown OpCode: ' + toHex(b) +
                        ' at ' + toHex(this.pc - 1, 4));
                },
                modeFn: this.implied,
                mode: modes.implied
            }
        }
        this.ops[b] = unk;
        return unk;
    }

    private dumpArgs(addr: word, m: Mode, symbols: symbols) {
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
        op.op(op.modeFn);

        if (cb) {
            cb(this);
        }
    }

    public stepDebug(n: number, cb: callback) {
        for (let idx = 0; idx < n; idx++) {
            this.sync = true;
            let op = this.opary[this.readBytePC()];
            this.sync = false;
            op.op(op.modeFn);

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
            op.op(op.modeFn);
        }
    }

    public stepCyclesDebug(c: number, cb: callback): void {
        var op, end = this.cycles + c;

        while (this.cycles < end) {
            this.sync = true;
            op = this.opary[this.readBytePC()];
            this.sync = false;
            op.op(op.modeFn);

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
            size = modes[op.mode],
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
            result += op.name + ' ' + this.dumpArgs(pc + 1, op.mode, symbols);

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
            _pc += modes[op.mode];
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

    OPS_6502: Instructions = {
        // LDA
        0xa9: { name: 'LDA', op: this.lda, modeFn: this.readImmediate, mode: modes.immediate },
        0xa5: { name: 'LDA', op: this.lda, modeFn: this.readZeroPage, mode: modes.zeroPage },
        0xb5: { name: 'LDA', op: this.lda, modeFn: this.readZeroPageX, mode: modes.zeroPageX },
        0xad: { name: 'LDA', op: this.lda, modeFn: this.readAbsolute, mode: modes.absolute },
        0xbd: { name: 'LDA', op: this.lda, modeFn: this.readAbsoluteX, mode: modes.absoluteX },
        0xb9: { name: 'LDA', op: this.lda, modeFn: this.readAbsoluteY, mode: modes.absoluteY },
        0xa1: { name: 'LDA', op: this.lda, modeFn: this.readZeroPageXIndirect, mode: modes.zeroPageXIndirect },
        0xb1: { name: 'LDA', op: this.lda, modeFn: this.readZeroPageIndirectY, mode: modes.zeroPageIndirectY },

        // LDX
        0xa2: { name: 'LDX', op: this.ldx, modeFn: this.readImmediate, mode: modes.immediate },
        0xa6: { name: 'LDX', op: this.ldx, modeFn: this.readZeroPage, mode: modes.zeroPage },
        0xb6: { name: 'LDX', op: this.ldx, modeFn: this.readZeroPageY, mode: modes.zeroPageY },
        0xae: { name: 'LDX', op: this.ldx, modeFn: this.readAbsolute, mode: modes.absolute },
        0xbe: { name: 'LDX', op: this.ldx, modeFn: this.readAbsoluteY, mode: modes.absoluteY },

        // LDY
        0xa0: { name: 'LDY', op: this.ldy, modeFn: this.readImmediate, mode: modes.immediate },
        0xa4: { name: 'LDY', op: this.ldy, modeFn: this.readZeroPage, mode: modes.zeroPage },
        0xb4: { name: 'LDY', op: this.ldy, modeFn: this.readZeroPageX, mode: modes.zeroPageX },
        0xac: { name: 'LDY', op: this.ldy, modeFn: this.readAbsolute, mode: modes.absolute },
        0xbc: { name: 'LDY', op: this.ldy, modeFn: this.readAbsoluteX, mode: modes.absoluteX },

        // STA
        0x85: { name: 'STA', op: this.sta, modeFn: this.writeZeroPage, mode: modes.zeroPage },
        0x95: { name: 'STA', op: this.sta, modeFn: this.writeZeroPageX, mode: modes.zeroPageX },
        0x8d: { name: 'STA', op: this.sta, modeFn: this.writeAbsolute, mode: modes.absolute },
        0x9d: { name: 'STA', op: this.sta, modeFn: this.writeAbsoluteX, mode: modes.absoluteX },
        0x99: { name: 'STA', op: this.sta, modeFn: this.writeAbsoluteY, mode: modes.absoluteY },
        0x81: { name: 'STA', op: this.sta, modeFn: this.writeZeroPageXIndirect, mode: modes.zeroPageXIndirect },
        0x91: { name: 'STA', op: this.sta, modeFn: this.writeZeroPageIndirectY, mode: modes.zeroPageIndirectY },

        // STX
        0x86: { name: 'STX', op: this.stx, modeFn: this.writeZeroPage, mode: modes.zeroPage },
        0x96: { name: 'STX', op: this.stx, modeFn: this.writeZeroPageY, mode: modes.zeroPageY },
        0x8e: { name: 'STX', op: this.stx, modeFn: this.writeAbsolute, mode: modes.absolute },

        // STY
        0x84: { name: 'STY', op: this.sty, modeFn: this.writeZeroPage, mode: modes.zeroPage },
        0x94: { name: 'STY', op: this.sty, modeFn: this.writeZeroPageX, mode: modes.zeroPageX },
        0x8c: { name: 'STY', op: this.sty, modeFn: this.writeAbsolute, mode: modes.absolute },

        // ADC
        0x69: { name: 'ADC', op: this.adc, modeFn: this.readImmediate, mode: modes.immediate },
        0x65: { name: 'ADC', op: this.adc, modeFn: this.readZeroPage, mode: modes.zeroPage },
        0x75: { name: 'ADC', op: this.adc, modeFn: this.readZeroPageX, mode: modes.zeroPageX },
        0x6D: { name: 'ADC', op: this.adc, modeFn: this.readAbsolute, mode: modes.absolute },
        0x7D: { name: 'ADC', op: this.adc, modeFn: this.readAbsoluteX, mode: modes.absoluteX },
        0x79: { name: 'ADC', op: this.adc, modeFn: this.readAbsoluteY, mode: modes.absoluteY },
        0x61: { name: 'ADC', op: this.adc, modeFn: this.readZeroPageXIndirect, mode: modes.zeroPageXIndirect },
        0x71: { name: 'ADC', op: this.adc, modeFn: this.readZeroPageIndirectY, mode: modes.zeroPageIndirectY },

        // SBC
        0xe9: { name: 'SBC', op: this.sbc, modeFn: this.readImmediate, mode: modes.immediate },
        0xe5: { name: 'SBC', op: this.sbc, modeFn: this.readZeroPage, mode: modes.zeroPage },
        0xf5: { name: 'SBC', op: this.sbc, modeFn: this.readZeroPageX, mode: modes.zeroPageX },
        0xeD: { name: 'SBC', op: this.sbc, modeFn: this.readAbsolute, mode: modes.absolute },
        0xfD: { name: 'SBC', op: this.sbc, modeFn: this.readAbsoluteX, mode: modes.absoluteX },
        0xf9: { name: 'SBC', op: this.sbc, modeFn: this.readAbsoluteY, mode: modes.absoluteY },
        0xe1: { name: 'SBC', op: this.sbc, modeFn: this.readZeroPageXIndirect, mode: modes.zeroPageXIndirect },
        0xf1: { name: 'SBC', op: this.sbc, modeFn: this.readZeroPageIndirectY, mode: modes.zeroPageIndirectY },

        // INC
        0xe6: { name: 'INC', op: this.inc, modeFn: this.readAddrZeroPage, mode: modes.zeroPage },
        0xf6: { name: 'INC', op: this.inc, modeFn: this.readAddrZeroPageX, mode: modes.zeroPageX },
        0xee: { name: 'INC', op: this.inc, modeFn: this.readAddrAbsolute, mode: modes.absolute },
        0xfe: { name: 'INC', op: this.inc, modeFn: this.readAddrAbsoluteX, mode: modes.absoluteX },

        // INX
        0xe8: { name: 'INX', op: this.inx, modeFn: this.implied, mode: modes.implied },

        // INY
        0xc8: { name: 'INY', op: this.iny, modeFn: this.implied, mode: modes.implied },

        // DEC
        0xc6: { name: 'DEC', op: this.dec, modeFn: this.readAddrZeroPage, mode: modes.zeroPage },
        0xd6: { name: 'DEC', op: this.dec, modeFn: this.readAddrZeroPageX, mode: modes.zeroPageX },
        0xce: { name: 'DEC', op: this.dec, modeFn: this.readAddrAbsolute, mode: modes.absolute },
        0xde: { name: 'DEC', op: this.dec, modeFn: this.readAddrAbsoluteX, mode: modes.absoluteX },

        // DEX
        0xca: { name: 'DEX', op: this.dex, modeFn: this.implied, mode: modes.implied },

        // DEY
        0x88: { name: 'DEY', op: this.dey, modeFn: this.implied, mode: modes.implied },

        // ASL
        0x0A: { name: 'ASL', op: this.aslA, modeFn: this.implied, mode: modes.accumulator },
        0x06: { name: 'ASL', op: this.asl, modeFn: this.readAddrZeroPage, mode: modes.zeroPage },
        0x16: { name: 'ASL', op: this.asl, modeFn: this.readAddrZeroPageX, mode: modes.zeroPageX },
        0x0E: { name: 'ASL', op: this.asl, modeFn: this.readAddrAbsolute, mode: modes.absolute },
        0x1E: { name: 'ASL', op: this.asl, modeFn: this.readAddrAbsoluteX, mode: modes.absoluteX },

        // LSR
        0x4A: { name: 'LSR', op: this.lsrA, modeFn: this.implied, mode: modes.accumulator },
        0x46: { name: 'LSR', op: this.lsr, modeFn: this.readAddrZeroPage, mode: modes.zeroPage },
        0x56: { name: 'LSR', op: this.lsr, modeFn: this.readAddrZeroPageX, mode: modes.zeroPageX },
        0x4E: { name: 'LSR', op: this.lsr, modeFn: this.readAddrAbsolute, mode: modes.absolute },
        0x5E: { name: 'LSR', op: this.lsr, modeFn: this.readAddrAbsoluteX, mode: modes.absoluteX },

        // ROL
        0x2A: { name: 'ROL', op: this.rolA, modeFn: this.implied, mode: modes.accumulator },
        0x26: { name: 'ROL', op: this.rol, modeFn: this.readAddrZeroPage, mode: modes.zeroPage },
        0x36: { name: 'ROL', op: this.rol, modeFn: this.readAddrZeroPageX, mode: modes.zeroPageX },
        0x2E: { name: 'ROL', op: this.rol, modeFn: this.readAddrAbsolute, mode: modes.absolute },
        0x3E: { name: 'ROL', op: this.rol, modeFn: this.readAddrAbsoluteX, mode: modes.absoluteX },

        // ROR
        0x6A: { name: 'ROR', op: this.rorA, modeFn: this.implied, mode: modes.accumulator },
        0x66: { name: 'ROR', op: this.ror, modeFn: this.readAddrZeroPage, mode: modes.zeroPage },
        0x76: { name: 'ROR', op: this.ror, modeFn: this.readAddrZeroPageX, mode: modes.zeroPageX },
        0x6E: { name: 'ROR', op: this.ror, modeFn: this.readAddrAbsolute, mode: modes.absolute },
        0x7E: { name: 'ROR', op: this.ror, modeFn: this.readAddrAbsoluteX, mode: modes.absoluteX },

        // AND
        0x29: { name: 'AND', op: this.and, modeFn: this.readImmediate, mode: modes.immediate },
        0x25: { name: 'AND', op: this.and, modeFn: this.readZeroPage, mode: modes.zeroPage },
        0x35: { name: 'AND', op: this.and, modeFn: this.readZeroPageX, mode: modes.zeroPageX },
        0x2D: { name: 'AND', op: this.and, modeFn: this.readAbsolute, mode: modes.absolute },
        0x3D: { name: 'AND', op: this.and, modeFn: this.readAbsoluteX, mode: modes.absoluteX },
        0x39: { name: 'AND', op: this.and, modeFn: this.readAbsoluteY, mode: modes.absoluteY },
        0x21: { name: 'AND', op: this.and, modeFn: this.readZeroPageXIndirect, mode: modes.zeroPageXIndirect },
        0x31: { name: 'AND', op: this.and, modeFn: this.readZeroPageIndirectY, mode: modes.zeroPageIndirectY },

        // ORA
        0x09: { name: 'ORA', op: this.ora, modeFn: this.readImmediate, mode: modes.immediate },
        0x05: { name: 'ORA', op: this.ora, modeFn: this.readZeroPage, mode: modes.zeroPage },
        0x15: { name: 'ORA', op: this.ora, modeFn: this.readZeroPageX, mode: modes.zeroPageX },
        0x0D: { name: 'ORA', op: this.ora, modeFn: this.readAbsolute, mode: modes.absolute },
        0x1D: { name: 'ORA', op: this.ora, modeFn: this.readAbsoluteX, mode: modes.absoluteX },
        0x19: { name: 'ORA', op: this.ora, modeFn: this.readAbsoluteY, mode: modes.absoluteY },
        0x01: { name: 'ORA', op: this.ora, modeFn: this.readZeroPageXIndirect, mode: modes.zeroPageXIndirect },
        0x11: { name: 'ORA', op: this.ora, modeFn: this.readZeroPageIndirectY, mode: modes.zeroPageIndirectY },

        // EOR
        0x49: { name: 'EOR', op: this.eor, modeFn: this.readImmediate, mode: modes.immediate },
        0x45: { name: 'EOR', op: this.eor, modeFn: this.readZeroPage, mode: modes.zeroPage },
        0x55: { name: 'EOR', op: this.eor, modeFn: this.readZeroPageX, mode: modes.zeroPageX },
        0x4D: { name: 'EOR', op: this.eor, modeFn: this.readAbsolute, mode: modes.absolute },
        0x5D: { name: 'EOR', op: this.eor, modeFn: this.readAbsoluteX, mode: modes.absoluteX },
        0x59: { name: 'EOR', op: this.eor, modeFn: this.readAbsoluteY, mode: modes.absoluteY },
        0x41: { name: 'EOR', op: this.eor, modeFn: this.readZeroPageXIndirect, mode: modes.zeroPageXIndirect },
        0x51: { name: 'EOR', op: this.eor, modeFn: this.readZeroPageIndirectY, mode: modes.zeroPageIndirectY },

        // CMP
        0xc9: { name: 'CMP', op: this.cmp, modeFn: this.readImmediate, mode: modes.immediate },
        0xc5: { name: 'CMP', op: this.cmp, modeFn: this.readZeroPage, mode: modes.zeroPage },
        0xd5: { name: 'CMP', op: this.cmp, modeFn: this.readZeroPageX, mode: modes.zeroPageX },
        0xcD: { name: 'CMP', op: this.cmp, modeFn: this.readAbsolute, mode: modes.absolute },
        0xdD: { name: 'CMP', op: this.cmp, modeFn: this.readAbsoluteX, mode: modes.absoluteX },
        0xd9: { name: 'CMP', op: this.cmp, modeFn: this.readAbsoluteY, mode: modes.absoluteY },
        0xc1: { name: 'CMP', op: this.cmp, modeFn: this.readZeroPageXIndirect, mode: modes.zeroPageXIndirect },
        0xd1: { name: 'CMP', op: this.cmp, modeFn: this.readZeroPageIndirectY, mode: modes.zeroPageIndirectY },

        // CPX
        0xE0: { name: 'CPX', op: this.cpx, modeFn: this.readImmediate, mode: modes.immediate },
        0xE4: { name: 'CPX', op: this.cpx, modeFn: this.readZeroPage, mode: modes.zeroPage },
        0xEC: { name: 'CPX', op: this.cpx, modeFn: this.readAbsolute, mode: modes.absolute },

        // CPY
        0xC0: { name: 'CPY', op: this.cpy, modeFn: this.readImmediate, mode: modes.immediate },
        0xC4: { name: 'CPY', op: this.cpy, modeFn: this.readZeroPage, mode: modes.zeroPage },
        0xCC: { name: 'CPY', op: this.cpy, modeFn: this.readAbsolute, mode: modes.absolute },

        // BIT
        0x24: { name: 'BIT', op: this.bit, modeFn: this.readZeroPage, mode: modes.zeroPage },
        0x2C: { name: 'BIT', op: this.bit, modeFn: this.readAbsolute, mode: modes.absolute },

        // BCC
        0x90: { name: 'BCC', op: this.brc, modeFn: flags.C, mode: modes.relative },

        // BCS
        0xB0: { name: 'BCS', op: this.brs, modeFn: flags.C, mode: modes.relative },

        // BEQ
        0xF0: { name: 'BEQ', op: this.brs, modeFn: flags.Z, mode: modes.relative },

        // BMI
        0x30: { name: 'BMI', op: this.brs, modeFn: flags.N, mode: modes.relative },

        // BNE
        0xD0: { name: 'BNE', op: this.brc, modeFn: flags.Z, mode: modes.relative },

        // BPL
        0x10: { name: 'BPL', op: this.brc, modeFn: flags.N, mode: modes.relative },

        // BVC
        0x50: { name: 'BVC', op: this.brc, modeFn: flags.V, mode: modes.relative },

        // BVS
        0x70: { name: 'BVS', op: this.brs, modeFn: flags.V, mode: modes.relative },

        // TAX
        0xAA: { name: 'TAX', op: this.tax, modeFn: this.implied, mode: modes.implied },

        // TXA
        0x8A: { name: 'TXA', op: this.txa, modeFn: this.implied, mode: modes.implied },

        // TAY
        0xA8: { name: 'TAY', op: this.tay, modeFn: this.implied, mode: modes.implied },

        // TYA
        0x98: { name: 'TYA', op: this.tya, modeFn: this.implied, mode: modes.implied },

        // TSX
        0xBA: { name: 'TSX', op: this.tsx, modeFn: this.implied, mode: modes.implied },

        // TXS
        0x9A: { name: 'TXS', op: this.txs, modeFn: this.implied, mode: modes.implied },

        // PHA
        0x48: { name: 'PHA', op: this.pha, modeFn: this.implied, mode: modes.implied },

        // PLA
        0x68: { name: 'PLA', op: this.pla, modeFn: this.implied, mode: modes.implied },

        // PHP
        0x08: { name: 'PHP', op: this.php, modeFn: this.implied, mode: modes.implied },

        // PLP
        0x28: { name: 'PLP', op: this.plp, modeFn: this.implied, mode: modes.implied },

        // JMP
        0x4C: {
            name: 'JMP', op: this.jmp, modeFn: this.readAddrAbsolute, mode: modes.absolute
        },
        0x6C: {
            name: 'JMP', op: this.jmp, modeFn: this.readAddrAbsoluteIndirectBug, mode: modes.absoluteIndirect
        },
        // JSR
        0x20: { name: 'JSR', op: this.jsr, modeFn: this.readAddrAbsolute, mode: modes.absolute },

        // RTS
        0x60: { name: 'RTS', op: this.rts, modeFn: this.implied, mode: modes.implied },

        // RTI
        0x40: { name: 'RTI', op: this.rti, modeFn: this.implied, mode: modes.implied },

        // SEC
        0x38: { name: 'SEC', op: this.set, modeFn: flags.C, mode: modes.implied },

        // SED
        0xF8: { name: 'SED', op: this.set, modeFn: flags.D, mode: modes.implied },

        // SEI
        0x78: { name: 'SEI', op: this.set, modeFn: flags.I, mode: modes.implied },

        // CLC
        0x18: { name: 'CLC', op: this.clr, modeFn: flags.C, mode: modes.implied },

        // CLD
        0xD8: { name: 'CLD', op: this.clr, modeFn: flags.D, mode: modes.implied },

        // CLI
        0x58: { name: 'CLI', op: this.clr, modeFn: flags.I, mode: modes.implied },

        // CLV
        0xB8: { name: 'CLV', op: this.clr, modeFn: flags.V, mode: modes.implied },

        // NOP
        0xea: { name: 'NOP', op: this.nop, modeFn: this.implied, mode: modes.implied },

        // BRK
        0x00: { name: 'BRK', op: this.brk, modeFn: this.readImmediate, mode: modes.immediate }
    };

/* 65C02 Instructions */

    OPS_65C02: Instructions = {
        // INC / DEC A
        0x1A: { name: 'INC', op: this.incA, modeFn: this.implied, mode: modes.accumulator },
        0x3A: { name: 'DEC', op: this.decA, modeFn: this.implied, mode: modes.accumulator },

        // Indirect Zero Page for the masses
        0x12: { name: 'ORA', op: this.ora, modeFn: this.readZeroPageIndirect, mode: modes.zeroPageIndirect },
        0x32: { name: 'AND', op: this.and, modeFn: this.readZeroPageIndirect, mode: modes.zeroPageIndirect },
        0x52: { name: 'EOR', op: this.eor, modeFn: this.readZeroPageIndirect, mode: modes.zeroPageIndirect },
        0x72: { name: 'ADC', op: this.adc, modeFn: this.readZeroPageIndirect, mode: modes.zeroPageIndirect },
        0x92: { name: 'STA', op: this.sta, modeFn: this.writeZeroPageIndirect, mode: modes.zeroPageIndirect },
        0xB2: { name: 'LDA', op: this.lda, modeFn: this.readZeroPageIndirect, mode: modes.zeroPageIndirect },
        0xD2: { name: 'CMP', op: this.cmp, modeFn: this.readZeroPageIndirect, mode: modes.zeroPageIndirect },
        0xF2: { name: 'SBC', op: this.sbc, modeFn: this.readZeroPageIndirect, mode: modes.zeroPageIndirect },

        // Better BIT
        0x34: { name: 'BIT', op: this.bit, modeFn: this.readZeroPageX, mode: modes.zeroPageX },
        0x3C: { name: 'BIT', op: this.bit, modeFn: this.readAbsoluteX, mode: modes.absoluteX },
        0x89: { name: 'BIT', op: this.bitI, modeFn: this.readImmediate, mode: modes.immediate },

        // JMP absolute indirect indexed
        0x6C: {
            name: 'JMP', op: this.jmp, modeFn: this.readAddrAbsoluteIndirect, mode: modes.absoluteIndirect
        },
        0x7C: {
            name: 'JMP', op: this.jmp, modeFn: this.readAddrAbsoluteXIndirect, mode: modes.absoluteXIndirect
        },

        // BBR/BBS
        0x0F: { name: 'BBR0', op: this.bbr, modeFn: 0, mode: modes.zeroPage_relative },
        0x1F: { name: 'BBR1', op: this.bbr, modeFn: 1, mode: modes.zeroPage_relative },
        0x2F: { name: 'BBR2', op: this.bbr, modeFn: 2, mode: modes.zeroPage_relative },
        0x3F: { name: 'BBR3', op: this.bbr, modeFn: 3, mode: modes.zeroPage_relative },
        0x4F: { name: 'BBR4', op: this.bbr, modeFn: 4, mode: modes.zeroPage_relative },
        0x5F: { name: 'BBR5', op: this.bbr, modeFn: 5, mode: modes.zeroPage_relative },
        0x6F: { name: 'BBR6', op: this.bbr, modeFn: 6, mode: modes.zeroPage_relative },
        0x7F: { name: 'BBR7', op: this.bbr, modeFn: 7, mode: modes.zeroPage_relative },

        0x8F: { name: 'BBS0', op: this.bbs, modeFn: 0, mode: modes.zeroPage_relative },
        0x9F: { name: 'BBS1', op: this.bbs, modeFn: 1, mode: modes.zeroPage_relative },
        0xAF: { name: 'BBS2', op: this.bbs, modeFn: 2, mode: modes.zeroPage_relative },
        0xBF: { name: 'BBS3', op: this.bbs, modeFn: 3, mode: modes.zeroPage_relative },
        0xCF: { name: 'BBS4', op: this.bbs, modeFn: 4, mode: modes.zeroPage_relative },
        0xDF: { name: 'BBS5', op: this.bbs, modeFn: 5, mode: modes.zeroPage_relative },
        0xEF: { name: 'BBS6', op: this.bbs, modeFn: 6, mode: modes.zeroPage_relative },
        0xFF: { name: 'BBS7', op: this.bbs, modeFn: 7, mode: modes.zeroPage_relative },

        // BRA
        0x80: { name: 'BRA', op: this.brc, modeFn: 0, mode: modes.relative },

        // NOP
        0x02: { name: 'NOP', op: this.nop, modeFn: this.readImmediate, mode: modes.immediate },
        0x22: { name: 'NOP', op: this.nop, modeFn: this.readImmediate, mode: modes.immediate },
        0x42: { name: 'NOP', op: this.nop, modeFn: this.readImmediate, mode: modes.immediate },
        0x44: { name: 'NOP', op: this.nop, modeFn: this.readImmediate, mode: modes.immediate },
        0x54: { name: 'NOP', op: this.nop, modeFn: this.readImmediate, mode: modes.immediate },
        0x62: { name: 'NOP', op: this.nop, modeFn: this.readImmediate, mode: modes.immediate },
        0x82: { name: 'NOP', op: this.nop, modeFn: this.readImmediate, mode: modes.immediate },
        0xC2: { name: 'NOP', op: this.nop, modeFn: this.readImmediate, mode: modes.immediate },
        0xD4: { name: 'NOP', op: this.nop, modeFn: this.readImmediate, mode: modes.immediate },
        0xE2: { name: 'NOP', op: this.nop, modeFn: this.readImmediate, mode: modes.immediate },
        0xF4: { name: 'NOP', op: this.nop, modeFn: this.readImmediate, mode: modes.immediate },
        0x5C: { name: 'NOP', op: this.nop, modeFn: this.readAbsolute, mode: modes.absolute },
        0xDC: { name: 'NOP', op: this.nop, modeFn: this.readAbsolute, mode: modes.absolute },
        0xFC: { name: 'NOP', op: this.nop, modeFn: this.readAbsolute, mode: modes.absolute },

        // PHX
        0xDA: { name: 'PHX', op: this.phx, modeFn: this.implied, mode: modes.implied },

        // PHY
        0x5A: { name: 'PHY', op: this.phy, modeFn: this.implied, mode: modes.implied },

        // PLX
        0xFA: { name: 'PLX', op: this.plx, modeFn: this.implied, mode: modes.implied },

        // PLY
        0x7A: { name: 'PLY', op: this.ply, modeFn: this.implied, mode: modes.implied },

        // RMB/SMB

        0x07: { name: 'RMB0', op: this.rmb, modeFn: 0, mode: modes.zeroPage },
        0x17: { name: 'RMB1', op: this.rmb, modeFn: 1, mode: modes.zeroPage },
        0x27: { name: 'RMB2', op: this.rmb, modeFn: 2, mode: modes.zeroPage },
        0x37: { name: 'RMB3', op: this.rmb, modeFn: 3, mode: modes.zeroPage },
        0x47: { name: 'RMB4', op: this.rmb, modeFn: 4, mode: modes.zeroPage },
        0x57: { name: 'RMB5', op: this.rmb, modeFn: 5, mode: modes.zeroPage },
        0x67: { name: 'RMB6', op: this.rmb, modeFn: 6, mode: modes.zeroPage },
        0x77: { name: 'RMB7', op: this.rmb, modeFn: 7, mode: modes.zeroPage },

        0x87: { name: 'SMB0', op: this.smb, modeFn: 0, mode: modes.zeroPage },
        0x97: { name: 'SMB1', op: this.smb, modeFn: 1, mode: modes.zeroPage },
        0xA7: { name: 'SMB2', op: this.smb, modeFn: 2, mode: modes.zeroPage },
        0xB7: { name: 'SMB3', op: this.smb, modeFn: 3, mode: modes.zeroPage },
        0xC7: { name: 'SMB4', op: this.smb, modeFn: 4, mode: modes.zeroPage },
        0xD7: { name: 'SMB5', op: this.smb, modeFn: 5, mode: modes.zeroPage },
        0xE7: { name: 'SMB6', op: this.smb, modeFn: 6, mode: modes.zeroPage },
        0xF7: { name: 'SMB7', op: this.smb, modeFn: 7, mode: modes.zeroPage },

        // STZ
        0x64: { name: 'STZ', op: this.stz, modeFn: this.writeZeroPage, mode: modes.zeroPage },
        0x74: { name: 'STZ', op: this.stz, modeFn: this.writeZeroPageX, mode: modes.zeroPageX },
        0x9C: { name: 'STZ', op: this.stz, modeFn: this.writeAbsolute, mode: modes.absolute },
        0x9E: { name: 'STZ', op: this.stz, modeFn: this.writeAbsoluteX, mode: modes.absoluteX },

        // TRB
        0x14: { name: 'TRB', op: this.trb, modeFn: this.readAddrZeroPage, mode: modes.zeroPage },
        0x1C: { name: 'TRB', op: this.trb, modeFn: this.readAddrAbsolute, mode: modes.absolute },

        // TSB
        0x04: { name: 'TSB', op: this.tsb, modeFn: this.readAddrZeroPage, mode: modes.zeroPage },
        0x0C: { name: 'TSB', op: this.tsb, modeFn: this.readAddrAbsolute, mode: modes.absolute }
    }
};
