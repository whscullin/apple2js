import { Memory, MemberOf, MemoryPages, byte, word } from './types';
import { toHex } from './util';

export const FLAVOR_6502 = '6502';
export const FLAVOR_ROCKWELL_65C02 = 'rockwell65c02';
export const FLAVOR_WDC_65C02 = 'wdc65c02';

export const FLAVORS_65C02 = [
    FLAVOR_ROCKWELL_65C02,
    FLAVOR_WDC_65C02
];

export const FLAVORS = [
    FLAVOR_6502,
    ...FLAVORS_65C02
];

export type Flavor = MemberOf<typeof FLAVORS>;

export interface CpuOptions {
    flavor?: Flavor;
}

export interface CpuState {
    /** Accumulator */
    a: byte;
    /** X index */
    x: byte;
    /** Y index */
    y: byte;
    /** Status register */
    s: byte;
    /** Program counter */
    pc: word;
    /** Stack pointer */
    sp: byte;
    /** Elapsed cycles */
    cycles: number;
}

export type Mode =
    'accumulator' |        // A (Accumulator)
    'implied' |            // Implied
    'immediate' |          // # Immediate
    'absolute' |           // a Absolute
    'zeroPage' |           // zp Zero Page
    'relative' |           // r Relative
    'absoluteX' |          // a,X Absolute, X
    'absoluteY' |          // a,Y Absolute, Y
    'zeroPageX' |          // zp,X Zero Page, X
    'zeroPageY' |          // zp,Y Zero Page, Y
    'absoluteIndirect' |   // (a) Indirect
    'zeroPageXIndirect' |  // (zp,X) Zero Page Indexed Indirect
    'zeroPageIndirectY' |  // (zp),Y Zero Page Indexed with Y
    'zeroPageIndirect' |   // (zp),
    'absoluteXIndirect' |  // (a, X),
    'zeroPage_relative';   // zp, Relative

export type Modes = Record<Mode, number>;

/** Addressing mode name to instruction size mapping. */
export const sizes: Modes = {
    accumulator: 1,
    implied: 1,
    immediate: 2,
    absolute: 3,
    zeroPage: 2,
    relative: 2,

    absoluteX: 3,
    absoluteY: 3,
    zeroPageX: 2,
    zeroPageY: 2,

    absoluteIndirect: 3,
    zeroPageXIndirect: 2,
    zeroPageIndirectY: 2,

    /* 65c02 */
    zeroPageIndirect: 2,
    absoluteXIndirect: 3,
    zeroPage_relative: 3
};

/** Status register flag numbers. */
export type flag = 0x80 | 0x40 | 0x20 | 0x10 | 0x08 | 0x04 | 0x02 | 0x01;

/**
 *
 */
export type DebugInfo = {
    /** Program counter */
    pc: word;
    /** Accumulator */
    ar: byte;
    /** X index */
    xr: byte;
    /** Y index */
    yr: byte;
    /** Status register */
    sr: byte;
    /** Stack pointer */
    sp: byte;
    /** Current command */
    cmd: byte[];
};

/** Flags to status byte mask. */
export const flags: { [key: string]: flag } = {
    N: 0x80, // Negative
    V: 0x40, // oVerflow
    X: 0x20, // Unused, always 1
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

interface ResettablePageHandler extends MemoryPages {
    reset(): void;
}

function isResettablePageHandler(pageHandler: MemoryPages | ResettablePageHandler): pageHandler is ResettablePageHandler {
    return (pageHandler as ResettablePageHandler).reset !== undefined;
}

const BLANK_PAGE: Memory = {
    read: function () { return 0; },
    write: function () { /* not writable */ }
};

interface Opts {
    inc?: boolean;
}

type ReadFn = () => byte;
type WriteFn = (val: byte) => void;
type ReadAddrFn = (opts?: Opts) => word;
type ImpliedFn = () => void;

interface Instruction {
    name: string;
    mode: Mode;
    fn: () => void;
}

type Instructions = Record<byte, Instruction>;

type callback = (cpu: CPU6502) => boolean | void;

export default class CPU6502 {
    /** flavor */
    private readonly flavor: Flavor;
    /** 65C02 emulation mode flag */
    private readonly is65C02: boolean;

    /**
     * Registers
     */

    /** Program counter */
    private pc: word = 0;
    /** Status register */
    private sr: byte = flags.X;
    /** Accumulator */
    private ar: byte = 0;
    /** X index */
    private xr: byte = 0;
    /** Y index */
    private yr: byte = 0;
    /** Stack pointer */
    private sp: byte = 0xff;

    /** Current instruction */
    private op: Instruction;
    /** Last accessed memory address */
    private addr: word = 0;

    /** Filled array of memory handlers by address page */
    private memPages: Memory[] = new Array<Memory>(0x100);
    /** Callbacks invoked on reset signal */
    private resetHandlers: ResettablePageHandler[] = [];
    /** Elapsed cycles */
    private cycles = 0;
    /** Command being fetched signal */
    private sync = false;

    /** Processor is in WAI mode */
    private wait = false;
    /** Processor is in STP mode */
    private stop = false;

    /** Filled array of CPU operations */
    private readonly opary: Instruction[];

    constructor({ flavor }: CpuOptions = {}) {
        this.flavor = flavor ?? FLAVOR_6502;
        this.is65C02 = !!flavor && FLAVORS_65C02.includes(flavor);

        this.memPages.fill(BLANK_PAGE);
        this.memPages.fill(BLANK_PAGE);

        // Create this CPU's instruction table

        let ops = { ...this.OPS_6502 };

        switch (this.flavor) {
            case FLAVOR_WDC_65C02:
                ops = {
                    ...ops,
                    ...this.OPS_65C02,
                    ...this.OPS_WDC_65C02,
                };
                break;
            case FLAVOR_ROCKWELL_65C02:
                ops = {
                    ...ops,
                    ...this.OPS_65C02,
                    ...this.OPS_ROCKWELL_65C02,
                };
                break;
            default:
                ops = {
                    ...ops,
                    ...this.OPS_NMOS_6502,
                };
        }

        // Certain browsers benefit from using arrays over maps
        this.opary = new Array<Instruction>(0x100);

        for (let idx = 0; idx < 0x100; idx++) {
            this.opary[idx] = ops[idx] || this.unknown(idx);
        }
    }

    /**
     * Set or clears `f` in the status register. `f` must be a byte with a
     * single bit set.
     */
    private setFlag(f: flag, on: boolean) {
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
    private add(a: byte, b: byte, sub: boolean): byte {
        const a7 = a >> 7;
        const b7 = b >> 7;
        const ci = this.sr & flags.C;
        let c;
        let co;
        let v;
        let n;
        let z;

        const updateFlags = (c: byte) => {
            const bin = c & 0xff;
            n = bin >> 7;
            co = c >> 8;
            z = !((a + b + ci) & 0xff);
            v = a7 ^ b7 ^ n ^ co;
        };

        const updateBCDFlags = (c: byte) => {
            if (this.is65C02) {
                const bin = c & 0xff;
                n = bin >> 7;
                z = !bin;
                if (this.op.mode === 'immediate') {
                    if (this.flavor === FLAVOR_WDC_65C02) {
                        this.readByte(sub ? 0xB8 : 0x7F);
                    } else { // rockwell65c02
                        this.readByte(sub ? 0xB1 : 0x59);
                    }
                } else {
                    this.readByte(this.addr);
                }
            }
            if (!sub) {
                co = c >> 8;
            }
        };

        c = (a & 0x0f) + (b & 0x0f) + ci;
        if ((this.sr & flags.D) !== 0) {
            // BCD
            if (sub) {
                if (c < 0x10) {
                    c = (c - 0x06) & 0x0f;
                }
                c += (a & 0xf0) + (b & 0xf0);
                updateFlags(c);
                if (c < 0x100) {
                    c += 0xa0;
                }
            } else {
                if (c > 0x9) {
                    c = 0x10 + ((c + 0x6) & 0xf);
                }
                c += (a & 0xf0) + (b & 0xf0);
                updateFlags(c);
                if (c >= 0xa0) {
                    c += 0x60;
                }
            }
            updateBCDFlags(c);
        } else {
            c += (a & 0xf0) + (b & 0xf0);
            updateFlags(c);
        }
        c = c & 0xff;

        this.setFlag(flags.N, !!n);
        this.setFlag(flags.V, !!v);
        this.setFlag(flags.Z, !!z);
        this.setFlag(flags.C, !!co);

        return c;
    }

    /** Increments `a` and returns the value, setting the status register. */
    private increment(a: byte) {
        return this.testNZ((a + 0x01) & 0xff);
    }

    private decrement(a: byte) {
        return this.testNZ((a + 0xff) & 0xff);
    }

    private readBytePC(): byte {
        const result = this.readByte(this.pc);

        this.pc = (this.pc + 1) & 0xffff;

        return result;
    }

    private readByte(addr: word): byte {
        this.addr = addr;
        const page = addr >> 8,
            off = addr & 0xff;

        const result = this.memPages[page].read(page, off);

        this.cycles++;

        return result;
    }

    private writeByte(addr: word, val: byte) {
        this.addr = addr;
        const page = addr >> 8,
            off = addr & 0xff;

        this.memPages[page].write(page, off, val);

        this.cycles++;
    }

    private readWord(addr: word): word {
        return this.readByte(addr) | (this.readByte(addr + 1) << 8);
    }

    private readWordPC(): word {
        return this.readBytePC() | (this.readBytePC() << 8);
    }

    private readZPWord(addr: byte): word {
        const lsb = this.readByte(addr & 0xff);
        const msb = this.readByte((addr + 1) & 0xff);

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
        const lsb = this.pullByte();
        const msb = this.pullByte();

        return (msb << 8) | lsb;
    }

    // Helpers that replicate false reads and writes during work cycles that
    // vary between CPU versions

    private workCycle(addr: word, val: byte) {
        if (this.is65C02) {
            this.readByte(addr);
        } else {
            this.writeByte(addr, val);
        }
    }

    private workCycleIndexedWrite(pc: word, addr: word, addrIdx: word): void {
        const oldPage = addr & 0xff00;
        if (this.is65C02) {
            this.readByte(pc);
        } else {
            const off = addrIdx & 0xff;
            this.readByte(oldPage | off);
        }
    }

    private workCycleIndexedRead(pc: word, addr: word, addrIdx: word): void {
        const oldPage = addr & 0xff00;
        const newPage = addrIdx & 0xff00;
        if (newPage !== oldPage) {
            if (this.is65C02) {
                this.readByte(pc);
            } else {
                const off = addrIdx & 0xff;
                this.readByte(oldPage | off);
            }
        }
    }

    /*
     * Implied function
     */

    implied = () => {
        this.readByte(this.pc);
    };

    /*
     * Read functions
     */

    // #$00
    readImmediate = (): byte => {
        return this.readBytePC();
    };

    // $0000
    readAbsolute = (): byte => {
        return this.readByte(this.readWordPC());
    };

    // $00
    readZeroPage = (): byte => {
        return this.readByte(this.readBytePC());
    };

    // $0000,X
    readAbsoluteX = (): byte => {
        const addr = this.readWordPC();
        const pc = this.addr;
        const addrIdx = (addr + this.xr) & 0xffff;
        this.workCycleIndexedRead(pc, addr, addrIdx);
        return this.readByte(addrIdx);
    };

    // $0000,Y
    readAbsoluteY = (): byte => {
        const addr = this.readWordPC();
        const pc = this.addr;
        const addrIdx = (addr + this.yr) & 0xffff;
        this.workCycleIndexedRead(pc, addr, addrIdx);
        return this.readByte(addrIdx);
    };

    // $00,X
    readZeroPageX = (): byte => {
        const zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        return this.readByte((zpAddr + this.xr) & 0xff);
    };

    // $00,Y
    readZeroPageY = (): byte => {
        const zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        return this.readByte((zpAddr + this.yr) & 0xff);
    };

    // ($00,X)
    readZeroPageXIndirect = (): byte => {
        const zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        const addr = this.readZPWord((zpAddr + this.xr) & 0xff);
        return this.readByte(addr);
    };

    // ($00),Y
    readZeroPageIndirectY = (): byte => {
        const zpAddr = this.readBytePC();
        const pc = this.addr;
        const addr = this.readZPWord(zpAddr);
        const addrIdx = (addr + this.yr) & 0xffff;
        this.workCycleIndexedRead(pc, addr, addrIdx);
        return this.readByte(addrIdx);
    };

    // ($00) (65C02)
    readZeroPageIndirect = (): byte => {
        return this.readByte(this.readZPWord(this.readBytePC()));
    };

    /*
     * Write Functions
     */

    // $0000
    writeAbsolute = (val: byte) => {
        this.writeByte(this.readWordPC(), val);
    };

    // $00
    writeZeroPage = (val: byte) => {
        this.writeByte(this.readBytePC(), val);
    };

    // $0000,X
    writeAbsoluteX = (val: byte) => {
        const addr = this.readWordPC();
        const pc = this.addr;
        const addrIdx = (addr + this.xr) & 0xffff;
        this.workCycleIndexedWrite(pc, addr, addrIdx);
        this.writeByte(addrIdx, val);
    };

    // $0000,Y
    writeAbsoluteY = (val: byte) => {
        const addr = this.readWordPC();
        const pc = this.addr;
        const addrIdx = (addr + this.yr) & 0xffff;
        this.workCycleIndexedWrite(pc, addr, addrIdx);
        this.writeByte(addrIdx, val);
    };

    // $00,X
    writeZeroPageX = (val: byte) => {
        const zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        this.writeByte((zpAddr + this.xr) & 0xff, val);
    };

    // $00,Y
    writeZeroPageY = (val: byte) => {
        const zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        this.writeByte((zpAddr + this.yr) & 0xff, val);
    };

    // ($00,X)
    writeZeroPageXIndirect = (val: byte) => {
        const zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        const addr = this.readZPWord((zpAddr + this.xr) & 0xff);
        this.writeByte(addr, val);
    };

    // ($00),Y
    writeZeroPageIndirectY = (val: byte) => {
        const zpAddr = this.readBytePC();
        const pc = this.addr;
        const addr = this.readZPWord(zpAddr);
        const addrIdx = (addr + this.yr) & 0xffff;
        this.workCycleIndexedWrite(pc, addr, addrIdx);
        this.writeByte(addrIdx, val);
    };

    // ($00) (65C02)
    writeZeroPageIndirect = (val: byte) => {
        this.writeByte(this.readZPWord(this.readBytePC()), val);
    };

    // $00
    readAddrZeroPage = () => {
        return this.readBytePC();
    };

    // $00,X
    readAddrZeroPageX = () => {
        const zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        return (zpAddr + this.xr) & 0xff;
    };

    // $0000 (65C02)
    readAddrAbsolute = (): word => {
        return this.readWordPC();
    };

    // ($0000) (6502)
    readAddrAbsoluteIndirectBug = (): word => {
        const addr = this.readWordPC();
        const page = addr & 0xff00;
        const off = addr & 0x00ff;
        const lsb = this.readByte(addr);
        const msb = this.readByte(page | ((off + 0x01) & 0xff));
        return msb << 8 | lsb;
    };

    // ($0000) (65C02)
    readAddrAbsoluteIndirect = (): word => {
        const addr = this.readWord(this.readWordPC());
        this.readByte(this.addr);
        return addr;
    };

    // $0000,X
    readAddrAbsoluteX = (opts?: Opts): word => {
        let addr = this.readWordPC();
        const page = addr & 0xff00;
        addr = (addr + this.xr) & 0xffff;
        if (this.is65C02) {
            if (opts?.inc) {
                this.readByte(this.addr);
            } else {
                const newPage = addr & 0xff00;
                if (page !== newPage) {
                    this.readByte(this.addr);
                }
            }
        } else {
            const off = addr & 0x00ff;
            this.readByte(page | off);
        }
        return addr;
    };

    // $0000,Y (NMOS 6502)
    readAddrAbsoluteY = (): word => {
        let addr = this.readWordPC();
        const page = addr & 0xff00;
        addr = (addr + this.yr) & 0xffff;
        const off = addr & 0x00ff;
        this.readByte(page | off);
        return addr;
    };

    // ($00,X) (NMOS 6502)
    readAddrZeroPageXIndirect = () => {
        const zpAddr = this.readBytePC();
        this.readByte(zpAddr);
        return this.readZPWord((zpAddr + this.xr) & 0xff);
    };

    // ($00),Y (NMOS 6502)
    readAddrZeroPageIndirectY = () => {
        const zpAddr = this.readBytePC();
        const addr = this.readZPWord(zpAddr);
        const addrIdx = (addr + this.yr) & 0xffff;
        const oldPage = addr & 0xff00;
        const off = addrIdx & 0xff;
        this.readByte(oldPage | off);
        return addrIdx;
    };

    // $(0000,X) (65C02)
    readAddrAbsoluteXIndirect = (): word => {
        const lsb = this.readBytePC();
        const pc = this.addr;
        const msb = this.readBytePC();
        const addr = (((msb << 8) | lsb) + this.xr) & 0xffff;
        this.readByte(pc);
        return this.readWord(addr);
    };

    // 5C, DC, FC NOP (65C02)
    readNop = (): void => {
        this.readWordPC();
        this.readByte(this.addr);
    };

    // NOP (65C02)
    readNopImplied = (): void => {
        // Op is 1 cycle
    };

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
    };

    /* Stop (65C02) */
    stp = () => {
        this.stop = true;
        this.readByte(this.pc);
        this.readByte(this.pc);
    };

    /* Wait (65C02) */
    wai = () => {
        this.wait = true;
        this.readByte(this.pc);
        this.readByte(this.pc);
    };

    /* Load Accumulator */
    lda = (readFn: ReadFn) => {
        this.ar = this.testNZ(readFn());
    };

    /* Load X Register */
    ldx = (readFn: ReadFn) => {
        this.xr = this.testNZ(readFn());
    };

    /* Load Y Register */
    ldy = (readFn: ReadFn) => {
        this.yr = this.testNZ(readFn());
    };

    /* Store Accumulator */
    sta = (writeFn: WriteFn) => {
        writeFn(this.ar);
    };

    /* Store X Register */
    stx = (writeFn: WriteFn) => {
        writeFn(this.xr);
    };

    /* Store Y Register */
    sty = (writeFn: WriteFn) => {
        writeFn(this.yr);
    };

    /* Store Zero */
    stz = (writeFn: WriteFn) => {
        writeFn(0);
    };

    /* Add with Carry */
    adc = (readFn: ReadFn) => {
        this.ar = this.add(this.ar, readFn(), /* sub= */ false);
    };

    /* Subtract with Carry */
    sbc = (readFn: ReadFn) => {
        this.ar = this.add(this.ar, readFn() ^ 0xff, /* sub= */ true);
    };

    /* Increment Memory */
    incA = () => {
        this.readByte(this.pc);
        this.ar = this.increment(this.ar);
    };

    inc = (readAddrFn: ReadAddrFn) => {
        const addr = readAddrFn({ inc: true });
        const oldVal = this.readByte(addr);
        this.workCycle(addr, oldVal);
        const val = this.increment(oldVal);
        this.writeByte(addr, val);
    };

    /* Increment X */
    inx = () => {
        this.readByte(this.pc);
        this.xr = this.increment(this.xr);
    };

    /* Increment Y */
    iny = () => {
        this.readByte(this.pc);
        this.yr = this.increment(this.yr);
    };

    /* Decrement Memory */
    decA = () => {
        this.readByte(this.pc);
        this.ar = this.decrement(this.ar);
    };

    dec = (readAddrFn: ReadAddrFn) => {
        const addr = readAddrFn({ inc: true});
        const oldVal = this.readByte(addr);
        this.workCycle(addr, oldVal);
        const val = this.decrement(oldVal);
        this.writeByte(addr, val);
    };

    /* Decrement X */
    dex = () => {
        this.readByte(this.pc);
        this.xr = this.decrement(this.xr);
    };

    /* Decrement Y */
    dey = () => {
        this.readByte(this.pc);
        this.yr = this.decrement(this.yr);
    };

    shiftLeft = (val: byte) => {
        this.setFlag(flags.C, !!(val & 0x80));
        return this.testNZ((val << 1) & 0xff);
    };

    /* Arithmetic Shift Left */
    aslA = () => {
        this.readByte(this.pc);
        this.ar = this.shiftLeft(this.ar);
    };

    asl = (readAddrFn: ReadAddrFn) => {
        const addr = readAddrFn();
        const oldVal = this.readByte(addr);
        this.workCycle(addr, oldVal);
        const val = this.shiftLeft(oldVal);
        this.writeByte(addr, val);
    };

    shiftRight = (val: byte) => {
        this.setFlag(flags.C, !!(val & 0x01));
        return this.testNZ(val >> 1);
    };

    /* Logical Shift Right */
    lsrA = () => {
        this.readByte(this.pc);
        this.ar = this.shiftRight(this.ar);
    };

    lsr = (readAddrFn: ReadAddrFn) => {
        const addr = readAddrFn();
        const oldVal = this.readByte(addr);
        this.workCycle(addr, oldVal);
        const val = this.shiftRight(oldVal);
        this.writeByte(addr, val);
    };

    rotateLeft = (val: byte) => {
        const c = (this.sr & flags.C);
        this.setFlag(flags.C, !!(val & 0x80));
        return this.testNZ(((val << 1) | (c ? 0x01 : 0x00)) & 0xff);
    };

    /* Rotate Left */
    rolA = () => {
        this.readByte(this.pc);
        this.ar = this.rotateLeft(this.ar);
    };

    rol = (readAddrFn: ReadAddrFn) => {
        const addr = readAddrFn();
        const oldVal = this.readByte(addr);
        this.workCycle(addr, oldVal);
        const val = this.rotateLeft(oldVal);
        this.writeByte(addr, val);
    };

    private rotateRight(a: byte) {
        const c = (this.sr & flags.C);
        this.setFlag(flags.C, !!(a & 0x01));
        return this.testNZ((a >> 1) | (c ? 0x80 : 0x00));
    }

    /* Rotate Right */
    rorA = () => {
        this.readByte(this.pc);
        this.ar = this.rotateRight(this.ar);
    };

    ror = (readAddrFn: ReadAddrFn) => {
        const addr = readAddrFn();
        const oldVal = this.readByte(addr);
        this.workCycle(addr, oldVal);
        const val = this.rotateRight(oldVal);
        this.writeByte(addr, val);
    };

    /* Logical And Accumulator */
    and = (readFn: ReadFn) => {
        this.ar = this.testNZ(this.ar & readFn());
    };

    /* Logical Or Accumulator */
    ora = (readFn: ReadFn) => {
        this.ar = this.testNZ(this.ar | readFn());
    };

    /* Logical Exclusive Or Accumulator */
    eor = (readFn: ReadFn) => {
        this.ar = this.testNZ(this.ar ^ readFn());
    };

    /* Reset Bit */

    rmb = (b: byte) => {
        const bit = (0x1 << b) ^ 0xFF;
        const addr = this.readBytePC();
        let val = this.readByte(addr);
        this.readByte(addr);
        val &= bit;
        this.writeByte(addr, val);
    };

    /* Set Bit */

    smb = (b: byte) => {
        const bit = 0x1 << b;
        const addr = this.readBytePC();
        let val = this.readByte(addr);
        this.readByte(addr);
        val |= bit;
        this.writeByte(addr, val);
    };

    /* Test and Reset Bits */
    trb = (readAddrFn: ReadAddrFn) => {
        const addr = readAddrFn();
        const val = this.readByte(addr);
        this.testZ(val & this.ar);
        this.readByte(addr);
        this.writeByte(addr, val & ~this.ar);
    };

    /* Test and Set Bits */
    tsb = (readAddrFn: ReadAddrFn) => {
        const addr = readAddrFn();
        const val = this.readByte(addr);
        this.testZ(val & this.ar);
        this.readByte(addr);
        this.writeByte(addr, val | this.ar);
    };

    /* Bit */
    bit = (readFn: ReadFn) => {
        const val = readFn();
        this.setFlag(flags.Z, (val & this.ar) === 0);
        this.setFlag(flags.N, !!(val & 0x80));
        this.setFlag(flags.V, !!(val & 0x40));
    };

    /* Bit Immediate*/
    bitI = (readFn: ReadFn) => {
        const val = readFn();
        this.setFlag(flags.Z, (val & this.ar) === 0);
    };

    private compare(a: byte, b: byte) {
        b = (b ^ 0xff);
        const c = a + b + 1;
        this.setFlag(flags.C, c > 0xff);
        this.testNZ(c & 0xff);
    }

    cmp = (readFn: ReadFn) => {
        this.compare(this.ar, readFn());
    };

    cpx = (readFn: ReadFn) => {
        this.compare(this.xr, readFn());
    };

    cpy = (readFn: ReadFn) => {
        this.compare(this.yr, readFn());
    };

    /* Branches */
    brs = (f: flag) => {
        const off = this.readBytePC(); // changes pc
        if ((f & this.sr) !== 0) {
            this.readByte(this.pc);
            const oldPage = this.pc & 0xff00;
            this.pc += off > 127 ? off - 256 : off;
            this.pc &= 0xffff;
            const newPage = this.pc & 0xff00;
            const newOff = this.pc & 0xff;
            if (newPage !== oldPage) this.readByte(oldPage | newOff);
        }
    };

    brc = (f: flag|0) => {
        const off = this.readBytePC(); // changes pc
        if ((f & this.sr) === 0) {
            this.readByte(this.pc);
            const oldPage = this.pc & 0xff00;
            this.pc += off > 127 ? off - 256 : off;
            this.pc &= 0xffff;
            const newPage = this.pc & 0xff00;
            const newOff = this.pc & 0xff;
            if (newPage !== oldPage) this.readByte(oldPage | newOff);
        }
    };

    /* WDC 65C02 branches */

    bbr = (b: byte) => {
        const zpAddr = this.readBytePC();
        const val = this.readByte(zpAddr);
        this.writeByte(zpAddr, val);
        const off = this.readBytePC(); // changes pc
        const oldPc = this.pc;
        const oldPage = oldPc & 0xff00;

        let newPC = this.pc + (off > 127 ? off - 256 : off);
        newPC &= 0xffff;
        const newOff = newPC & 0xff;
        this.readByte(oldPage | newOff);
        if (((1 << b) & val) === 0) {
            this.pc = newPC;
        }
    };

    bbs = (b: byte) => {
        const zpAddr = this.readBytePC();
        const val = this.readByte(zpAddr);
        this.writeByte(zpAddr, val);
        const off = this.readBytePC(); // changes pc
        const oldPc = this.pc;
        const oldPage = oldPc & 0xff00;

        let newPC = this.pc + (off > 127 ? off - 256 : off);
        newPC &= 0xffff;
        const newOff = newPC & 0xff;
        this.readByte(oldPage | newOff);
        if (((1 << b) & val) !== 0) {
            this.pc = newPC;
        }
    };

    /* Transfers and stack */
    tax = () => { this.readByte(this.pc); this.testNZ(this.xr = this.ar); };

    txa = () => { this.readByte(this.pc); this.testNZ(this.ar = this.xr); };

    tay = () => { this.readByte(this.pc); this.testNZ(this.yr = this.ar); };

    tya = () => { this.readByte(this.pc); this.testNZ(this.ar = this.yr); };

    tsx = () => { this.readByte(this.pc); this.testNZ(this.xr = this.sp); };

    txs = () => { this.readByte(this.pc); this.sp = this.xr; };

    pha = () => { this.readByte(this.pc); this.pushByte(this.ar); };

    pla = () => { this.readByte(this.pc); this.readByte(0x0100 | this.sp); this.testNZ(this.ar = this.pullByte()); };

    phx = () => { this.readByte(this.pc); this.pushByte(this.xr); };

    plx = () => { this.readByte(this.pc); this.readByte(0x0100 | this.sp); this.testNZ(this.xr = this.pullByte()); };

    phy = () => { this.readByte(this.pc); this.pushByte(this.yr); };

    ply = () => { this.readByte(this.pc); this.readByte(0x0100 | this.sp); this.testNZ(this.yr = this.pullByte()); };

    php = () => { this.readByte(this.pc); this.pushByte(this.sr | flags.B); };

    plp = () => { this.readByte(this.pc); this.readByte(0x0100 | this.sp); this.sr = (this.pullByte() & ~flags.B) | flags.X; };

    /* Jump */
    jmp = (readAddrFn: ReadAddrFn) => {
        this.pc = readAddrFn();
    };

    /* Jump Subroutine */
    jsr = () => {
        const lsb = this.readBytePC();
        this.readByte(0x0100 | this.sp);
        this.pushWord(this.pc);
        const msb = this.readBytePC();
        this.pc = (msb << 8 | lsb) & 0xffff;
    };

    /* Return from Subroutine */
    rts = () => {
        this.readByte(this.pc);
        this.readByte(0x0100 | this.sp);
        const addr = this.pullWordRaw();
        this.readByte(addr);
        this.pc = (addr + 1) & 0xffff;
    };

    /* Return from Interrupt */
    rti = () => {
        this.readByte(this.pc);
        this.readByte(0x0100 | this.sp);
        this.sr = (this.pullByte() & ~flags.B) | flags.X;
        this.pc = this.pullWordRaw();
    };

    /* Set and Clear */
    set = (flag: flag) => {
        this.readByte(this.pc);
        this.sr |= flag;
    };

    clr = (flag: flag) => {
        this.readByte(this.pc);
        this.sr &= ~flag;
    };

    /* No-Op */
    nop = (readFn: ImpliedFn | ReadFn) => {
        readFn();
    };

    /* NMOS 6502 Illegal opcodes */

    /* ASO = ASL + ORA */
    aso = (readAddrFn: ReadAddrFn) => {
        const addr = readAddrFn();
        const oldVal = this.readByte(addr);
        this.workCycle(addr, oldVal);
        const val = this.shiftLeft(oldVal);
        this.writeByte(addr, val);
        this.ar |= val;
        this.testNZ(this.ar);
    };

    /* RLA = ROL + AND */
    rla = (readAddrFn: ReadAddrFn) => {
        const addr = readAddrFn();
        const oldVal = this.readByte(addr);
        this.workCycle(addr, oldVal);
        const val = this.rotateLeft(oldVal);
        this.writeByte(addr, val);
        this.ar &= val;
        this.testNZ(this.ar);
    };

    /* LSE = LSR + EOR */
    lse = (readAddrFn: ReadAddrFn) => {
        const addr = readAddrFn();
        const oldVal = this.readByte(addr);
        this.workCycle(addr, oldVal);
        const val = this.shiftRight(oldVal);
        this.writeByte(addr, val);
        this.ar ^= val;
        this.testNZ(this.ar);
    };

    /* RRA = ROR + ADC */
    rra = (readAddrFn: ReadAddrFn) => {
        const addr = readAddrFn();
        const oldVal = this.readByte(addr);
        this.workCycle(addr, oldVal);
        const val = this.rotateRight(oldVal);
        this.writeByte(addr, val);
        this.ar = this.add(this.ar, val, false);
    };

    /* AXS = Store A & X */
    axs = (writeFn: WriteFn) => {
        writeFn(this.ar & this.xr);
    };

    /* LAX = Load A & X */
    lax = (readFn: ReadFn) => {
        const val = readFn();
        this.ar = val;
        this.xr = val;
        this.testNZ(val);
    };

    /* DCM = DEC + CMP */
    dcm = (readAddrFn: ReadAddrFn) => {
        const addr = readAddrFn({ inc: true});
        const oldVal = this.readByte(addr);
        this.workCycle(addr, oldVal);
        const val = this.decrement(oldVal);
        this.writeByte(addr, val);
        this.compare(this.ar, val);
    };

    /* INS = INC + SBC */
    ins = (readAddrFn: ReadAddrFn) => {
        const addr = readAddrFn({ inc: true});
        const oldVal = this.readByte(addr);
        this.workCycle(addr, oldVal);
        const val = this.increment(oldVal);
        this.writeByte(addr, val);
        this.ar = this.add(this.ar, val ^ 0xff, true);
    };

    /* ALR = AND + LSR */
    alr = (readFn: ReadFn) => {
        const val = readFn() & this.ar;
        this.ar = this.shiftRight(val);
    };

    /* ARR = AND + ROR */
    arr = (readFn: ReadFn) => {
        const val = readFn() & this.ar;
        const ah = val >> 4;
        const al = val & 0xf;
        const b7 = val >> 7;
        const b6 = (val >> 6) & 0x1;
        this.ar = this.rotateRight(val);
        let c = !!b7;
        const v = !!(b7 ^ b6);
        if (this.sr & flags.D) {
            if (al + (al & 0x1) > 0x5) {
                this.ar = (this.ar & 0xf0) | ((this.ar + 0x6) & 0xf);
            }
            if (ah + (ah & 0x1) > 5) {
                c = true;
                this.ar =((this.ar + 0x60) & 0xff);
            }
        }
        this.setFlag(flags.V, v);
        this.setFlag(flags.C, c);
    };

    /* XAA = TAX + AND */
    xaa = (readFn: ReadFn) => {
        const val = readFn();
        this.ar = (this.xr & 0xEE) | (this.xr & this.ar & 0x11);
        this.ar = this.testNZ(this.ar & val);
    };

    /** OAL = ORA + AND */
    oal = (readFn: ReadFn) => {
        this.ar |= 0xEE;
        const val = this.testNZ(this.ar & readFn());
        this.ar = val;
        this.xr = val;
    };

    /* SAX = A & X + SBC */
    sax = (readFn: ReadFn) => {
        const a = this.xr & this.ar;
        let b = readFn();
        b = (b ^ 0xff);
        const c = a + b + 1;
        this.setFlag(flags.C, c > 0xff);
        this.xr = this.testNZ(c & 0xff);
    };

    /* TAS = X & Y -> S */
    tas = (readAddrFn: ReadAddrFn) => {
        const addr = readAddrFn();
        let val = this.xr & this.ar;
        this.sp = val;
        const msb = addr >> 8;
        val = val & ((msb + 1) & 0xff);
        this.writeByte(addr, val);
    };

    /* SAY = Y & AH + 1 */
    say = (readAddrFn: ReadAddrFn) => {
        const addr = readAddrFn();
        const msb = addr >> 8;
        const val = this.yr & ((msb + 1) & 0xff);
        this.writeByte(addr, val);
    };

    /* XAS = X & AH + 1 */
    xas = (readAddrFn: ReadAddrFn) => {
        const addr = readAddrFn();
        const msb = addr >> 8;
        const val = this.xr & ((msb + 1) & 0xff);
        this.writeByte(addr, val);
    };

    /* AXA = X & AH + 1 */
    axa = (readAddrFn: ReadAddrFn) => {
        const addr = readAddrFn();
        let val = this.xr & this.ar;
        const msb = addr >> 8;
        val = val & ((msb + 1) & 0xff);
        this.writeByte(addr, val);
    };

    /* ANC = AND with carry */
    anc = (readFn: ReadFn) => {
        this.ar = this.testNZ(this.ar & readFn());
        const c = !!(this.ar & 0x80);
        this.setFlag(flags.C, c);
    };

    /* LAS = RD & SP -> A, X, S */
    las = (readFn: ReadFn) => {
        const val = this.sp & readFn();
        this.sp = val;
        this.xr = val;
        this.ar = this.testNZ(val);
    };

    /* SKB/SKW */
    skp = (readFn: ReadFn) => {
        readFn();
    };

    /* HLT */
    hlt = (_impliedFn: ImpliedFn) => {
        this.readByte(this.pc);
        this.readByte(this.pc);
        // PC shouldn't have advanced
        this.pc = (--this.pc) & 0xffff;
        this.stop = true;
    };

    private unknown(b: byte) {
        let unk: Instruction;
        if (this.is65C02) {
            // Default behavior is a 1 cycle NOP
            unk = {
                name: 'NOP',
                fn: () => this.nop(this.readNopImplied),
                mode: 'implied',
            };
        } else {
            // All 6502 Instructions should be defined
            throw new Error(`Missing ${toHex(b)}`);
        }
        return unk;
    }

    public step(cb?: callback) {
        this.sync = true;
        this.op = this.opary[this.readBytePC()];
        this.sync = false;
        this.op.fn();

        cb?.(this);
    }

    public stepN(n: number, cb?: callback) {
        for (let idx = 0; idx < n; idx++) {
            this.sync = true;
            this.op = this.opary[this.readBytePC()];
            this.sync = false;
            this.op.fn();

            if (cb?.(this)) {
                return;
            }
        }
    }

    public stepCycles(c: number) {
        const end = this.cycles + c;

        while (this.cycles < end) {
            this.sync = true;
            this.op = this.opary[this.readBytePC()];
            this.sync = false;
            this.op.fn();
        }
    }

    public stepCyclesDebug(c: number, cb?: callback): void {
        const end = this.cycles + c;

        while (this.cycles < end) {
            this.sync = true;
            this.op = this.opary[this.readBytePC()];
            this.sync = false;
            this.op.fn();

            if (cb?.(this)) {
                return;
            }
        }
    }

    public addPageHandler(pho: (MemoryPages | ResettablePageHandler)) {
        for (let idx = pho.start(); idx <= pho.end(); idx++) {
            this.memPages[idx] = pho;
        }
        if (isResettablePageHandler(pho))
            this.resetHandlers.push(pho);
    }

    public reset() {
        // cycles = 0;
        this.sr = flags.X;
        this.sp = 0xff;
        this.ar = 0;
        this.yr = 0;
        this.xr = 0;
        this.pc = this.readWord(loc.RESET);
        this.wait = false;
        this.stop = false;

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
            this.wait = false;
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
        this.wait = false;
    }

    public getPC() {
        return this.pc;
    }

    public setPC(pc: word) {
        this.pc = pc;
    }

    public getDebugInfo(): DebugInfo {
        const b = this.read(this.pc);
        const op = this.opary[b];
        const size = sizes[op.mode];
        const cmd = new Array(size);
        cmd[0] = b;
        for (let idx = 1; idx < size; idx++) {
            cmd[idx] = this.read(this.pc + idx);
        }

        return {
            pc: this.pc,
            ar: this.ar,
            xr: this.xr,
            yr: this.yr,
            sr: this.sr,
            sp: this.sp,
            cmd
        };
    }
    public getSync() {
        return this.sync;
    }

    public getStop() {
        return this.stop;
    }

    public getWait() {
        return this.wait;
    }

    public getCycles() {
        return this.cycles;
    }

    public getOpInfo(opcode: byte) {
        return this.opary[opcode];
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

    public read(addr: word): byte;
    public read(page: byte, off: byte): byte;

    public read(a: number, b?: number): byte {
        let page, off;
        if (b !== undefined) {
            page = a & 0xff;
            off = b & 0xff;
        } else {
            page = (a >> 8) & 0xff;
            off = a & 0xff;
        }
        return this.memPages[page].read(page, off);
    }

    public write(addr: word, val: byte): void;
    public write(page: byte, off: byte, val: byte): void;

    public write(a: number, b: number, c?: byte): void {
        let page, off, val;

        if (c !== undefined ) {
            page = a & 0xff;
            off = b & 0xff;
            val = c & 0xff;
        } else {
            page = (a >> 8) & 0xff;
            off = a & 0xff;
            val = b & 0xff;
        }
        this.memPages[page].write(page, off, val);
    }

    OPS_6502: Instructions = {
        // LDA
        0xa9: { name: 'LDA', fn: () => this.lda(this.readImmediate), mode: 'immediate' },
        0xa5: { name: 'LDA', fn: () => this.lda(this.readZeroPage), mode: 'zeroPage' },
        0xb5: { name: 'LDA', fn: () => this.lda(this.readZeroPageX), mode: 'zeroPageX' },
        0xad: { name: 'LDA', fn: () => this.lda(this.readAbsolute), mode: 'absolute' },
        0xbd: { name: 'LDA', fn: () => this.lda(this.readAbsoluteX), mode: 'absoluteX' },
        0xb9: { name: 'LDA', fn: () => this.lda(this.readAbsoluteY), mode: 'absoluteY' },
        0xa1: { name: 'LDA', fn: () => this.lda(this.readZeroPageXIndirect), mode: 'zeroPageXIndirect' },
        0xb1: { name: 'LDA', fn: () => this.lda(this.readZeroPageIndirectY), mode: 'zeroPageIndirectY' },

        // LDX
        0xa2: { name: 'LDX', fn: () => this.ldx(this.readImmediate), mode: 'immediate' },
        0xa6: { name: 'LDX', fn: () => this.ldx(this.readZeroPage), mode: 'zeroPage' },
        0xb6: { name: 'LDX', fn: () => this.ldx(this.readZeroPageY), mode: 'zeroPageY' },
        0xae: { name: 'LDX', fn: () => this.ldx(this.readAbsolute), mode: 'absolute' },
        0xbe: { name: 'LDX', fn: () => this.ldx(this.readAbsoluteY), mode: 'absoluteY' },

        // LDY
        0xa0: { name: 'LDY', fn: () => this.ldy(this.readImmediate), mode: 'immediate' },
        0xa4: { name: 'LDY', fn: () => this.ldy(this.readZeroPage), mode: 'zeroPage' },
        0xb4: { name: 'LDY', fn: () => this.ldy(this.readZeroPageX), mode: 'zeroPageX' },
        0xac: { name: 'LDY', fn: () => this.ldy(this.readAbsolute), mode: 'absolute' },
        0xbc: { name: 'LDY', fn: () => this.ldy(this.readAbsoluteX), mode: 'absoluteX' },

        // STA
        0x85: { name: 'STA', fn: () => this.sta(this.writeZeroPage), mode: 'zeroPage' },
        0x95: { name: 'STA', fn: () => this.sta(this.writeZeroPageX), mode: 'zeroPageX' },
        0x8d: { name: 'STA', fn: () => this.sta(this.writeAbsolute), mode: 'absolute' },
        0x9d: { name: 'STA', fn: () => this.sta(this.writeAbsoluteX), mode: 'absoluteX' },
        0x99: { name: 'STA', fn: () => this.sta(this.writeAbsoluteY), mode: 'absoluteY' },
        0x81: { name: 'STA', fn: () => this.sta(this.writeZeroPageXIndirect), mode: 'zeroPageXIndirect' },
        0x91: { name: 'STA', fn: () => this.sta(this.writeZeroPageIndirectY), mode: 'zeroPageIndirectY' },

        // STX
        0x86: { name: 'STX', fn: () => this.stx(this.writeZeroPage), mode: 'zeroPage' },
        0x96: { name: 'STX', fn: () => this.stx(this.writeZeroPageY), mode: 'zeroPageY' },
        0x8e: { name: 'STX', fn: () => this.stx(this.writeAbsolute), mode: 'absolute' },

        // STY
        0x84: { name: 'STY', fn: () => this.sty(this.writeZeroPage), mode: 'zeroPage' },
        0x94: { name: 'STY', fn: () => this.sty(this.writeZeroPageX), mode: 'zeroPageX' },
        0x8c: { name: 'STY', fn: () => this.sty(this.writeAbsolute), mode: 'absolute' },

        // ADC
        0x69: { name: 'ADC', fn: () => this.adc(this.readImmediate), mode: 'immediate' },
        0x65: { name: 'ADC', fn: () => this.adc(this.readZeroPage), mode: 'zeroPage' },
        0x75: { name: 'ADC', fn: () => this.adc(this.readZeroPageX), mode: 'zeroPageX' },
        0x6D: { name: 'ADC', fn: () => this.adc(this.readAbsolute), mode: 'absolute' },
        0x7D: { name: 'ADC', fn: () => this.adc(this.readAbsoluteX), mode: 'absoluteX' },
        0x79: { name: 'ADC', fn: () => this.adc(this.readAbsoluteY), mode: 'absoluteY' },
        0x61: { name: 'ADC', fn: () => this.adc(this.readZeroPageXIndirect), mode: 'zeroPageXIndirect' },
        0x71: { name: 'ADC', fn: () => this.adc(this.readZeroPageIndirectY), mode: 'zeroPageIndirectY' },

        // SBC
        0xe9: { name: 'SBC', fn: () => this.sbc(this.readImmediate), mode: 'immediate' },
        0xe5: { name: 'SBC', fn: () => this.sbc(this.readZeroPage), mode: 'zeroPage' },
        0xf5: { name: 'SBC', fn: () => this.sbc(this.readZeroPageX), mode: 'zeroPageX' },
        0xeD: { name: 'SBC', fn: () => this.sbc(this.readAbsolute), mode: 'absolute' },
        0xfD: { name: 'SBC', fn: () => this.sbc(this.readAbsoluteX), mode: 'absoluteX' },
        0xf9: { name: 'SBC', fn: () => this.sbc(this.readAbsoluteY), mode: 'absoluteY' },
        0xe1: { name: 'SBC', fn: () => this.sbc(this.readZeroPageXIndirect), mode: 'zeroPageXIndirect' },
        0xf1: { name: 'SBC', fn: () => this.sbc(this.readZeroPageIndirectY), mode: 'zeroPageIndirectY' },

        // INC
        0xe6: { name: 'INC', fn: () => this.inc(this.readAddrZeroPage), mode: 'zeroPage' },
        0xf6: { name: 'INC', fn: () => this.inc(this.readAddrZeroPageX), mode: 'zeroPageX' },
        0xee: { name: 'INC', fn: () => this.inc(this.readAddrAbsolute), mode: 'absolute' },
        0xfe: { name: 'INC', fn: () => this.inc(this.readAddrAbsoluteX), mode: 'absoluteX' },

        // INX
        0xe8: { name: 'INX', fn: () => this.inx(), mode: 'implied' },

        // INY
        0xc8: { name: 'INY', fn: () => this.iny(), mode: 'implied' },

        // DEC
        0xc6: { name: 'DEC', fn: () => this.dec(this.readAddrZeroPage), mode: 'zeroPage' },
        0xd6: { name: 'DEC', fn: () => this.dec(this.readAddrZeroPageX), mode: 'zeroPageX' },
        0xce: { name: 'DEC', fn: () => this.dec(this.readAddrAbsolute), mode: 'absolute' },
        0xde: { name: 'DEC', fn: () => this.dec(this.readAddrAbsoluteX), mode: 'absoluteX' },

        // DEX
        0xca: { name: 'DEX', fn: () => this.dex(), mode: 'implied' },

        // DEY
        0x88: { name: 'DEY', fn: () => this.dey(), mode: 'implied' },

        // ASL
        0x0A: { name: 'ASL', fn: () => this.aslA(), mode: 'accumulator' },
        0x06: { name: 'ASL', fn: () => this.asl(this.readAddrZeroPage), mode: 'zeroPage' },
        0x16: { name: 'ASL', fn: () => this.asl(this.readAddrZeroPageX), mode: 'zeroPageX' },
        0x0E: { name: 'ASL', fn: () => this.asl(this.readAddrAbsolute), mode: 'absolute' },
        0x1E: { name: 'ASL', fn: () => this.asl(this.readAddrAbsoluteX), mode: 'absoluteX' },

        // LSR
        0x4A: { name: 'LSR', fn: () => this.lsrA(), mode: 'accumulator' },
        0x46: { name: 'LSR', fn: () => this.lsr(this.readAddrZeroPage), mode: 'zeroPage' },
        0x56: { name: 'LSR', fn: () => this.lsr(this.readAddrZeroPageX), mode: 'zeroPageX' },
        0x4E: { name: 'LSR', fn: () => this.lsr(this.readAddrAbsolute), mode: 'absolute' },
        0x5E: { name: 'LSR', fn: () => this.lsr(this.readAddrAbsoluteX), mode: 'absoluteX' },

        // ROL
        0x2A: { name: 'ROL', fn: () => this.rolA(), mode: 'accumulator' },
        0x26: { name: 'ROL', fn: () => this.rol(this.readAddrZeroPage), mode: 'zeroPage' },
        0x36: { name: 'ROL', fn: () => this.rol(this.readAddrZeroPageX), mode: 'zeroPageX' },
        0x2E: { name: 'ROL', fn: () => this.rol(this.readAddrAbsolute), mode: 'absolute' },
        0x3E: { name: 'ROL', fn: () => this.rol(this.readAddrAbsoluteX), mode: 'absoluteX' },

        // ROR
        0x6A: { name: 'ROR', fn: () => this.rorA(), mode: 'accumulator' },
        0x66: { name: 'ROR', fn: () => this.ror(this.readAddrZeroPage), mode: 'zeroPage' },
        0x76: { name: 'ROR', fn: () => this.ror(this.readAddrZeroPageX), mode: 'zeroPageX' },
        0x6E: { name: 'ROR', fn: () => this.ror(this.readAddrAbsolute), mode: 'absolute' },
        0x7E: { name: 'ROR', fn: () => this.ror(this.readAddrAbsoluteX), mode: 'absoluteX' },

        // AND
        0x29: { name: 'AND', fn: () => this.and(this.readImmediate), mode: 'immediate' },
        0x25: { name: 'AND', fn: () => this.and(this.readZeroPage), mode: 'zeroPage' },
        0x35: { name: 'AND', fn: () => this.and(this.readZeroPageX), mode: 'zeroPageX' },
        0x2D: { name: 'AND', fn: () => this.and(this.readAbsolute), mode: 'absolute' },
        0x3D: { name: 'AND', fn: () => this.and(this.readAbsoluteX), mode: 'absoluteX' },
        0x39: { name: 'AND', fn: () => this.and(this.readAbsoluteY), mode: 'absoluteY' },
        0x21: { name: 'AND', fn: () => this.and(this.readZeroPageXIndirect), mode: 'zeroPageXIndirect' },
        0x31: { name: 'AND', fn: () => this.and(this.readZeroPageIndirectY), mode: 'zeroPageIndirectY' },

        // ORA
        0x09: { name: 'ORA', fn: () => this.ora(this.readImmediate), mode: 'immediate' },
        0x05: { name: 'ORA', fn: () => this.ora(this.readZeroPage), mode: 'zeroPage' },
        0x15: { name: 'ORA', fn: () => this.ora(this.readZeroPageX), mode: 'zeroPageX' },
        0x0D: { name: 'ORA', fn: () => this.ora(this.readAbsolute), mode: 'absolute' },
        0x1D: { name: 'ORA', fn: () => this.ora(this.readAbsoluteX), mode: 'absoluteX' },
        0x19: { name: 'ORA', fn: () => this.ora(this.readAbsoluteY), mode: 'absoluteY' },
        0x01: { name: 'ORA', fn: () => this.ora(this.readZeroPageXIndirect), mode: 'zeroPageXIndirect' },
        0x11: { name: 'ORA', fn: () => this.ora(this.readZeroPageIndirectY), mode: 'zeroPageIndirectY' },

        // EOR
        0x49: { name: 'EOR', fn: () => this.eor(this.readImmediate), mode: 'immediate' },
        0x45: { name: 'EOR', fn: () => this.eor(this.readZeroPage), mode: 'zeroPage' },
        0x55: { name: 'EOR', fn: () => this.eor(this.readZeroPageX), mode: 'zeroPageX' },
        0x4D: { name: 'EOR', fn: () => this.eor(this.readAbsolute), mode: 'absolute' },
        0x5D: { name: 'EOR', fn: () => this.eor(this.readAbsoluteX), mode: 'absoluteX' },
        0x59: { name: 'EOR', fn: () => this.eor(this.readAbsoluteY), mode: 'absoluteY' },
        0x41: { name: 'EOR', fn: () => this.eor(this.readZeroPageXIndirect), mode: 'zeroPageXIndirect' },
        0x51: { name: 'EOR', fn: () => this.eor(this.readZeroPageIndirectY), mode: 'zeroPageIndirectY' },

        // CMP
        0xc9: { name: 'CMP', fn: () => this.cmp(this.readImmediate), mode: 'immediate' },
        0xc5: { name: 'CMP', fn: () => this.cmp(this.readZeroPage), mode: 'zeroPage' },
        0xd5: { name: 'CMP', fn: () => this.cmp(this.readZeroPageX), mode: 'zeroPageX' },
        0xcD: { name: 'CMP', fn: () => this.cmp(this.readAbsolute), mode: 'absolute' },
        0xdD: { name: 'CMP', fn: () => this.cmp(this.readAbsoluteX), mode: 'absoluteX' },
        0xd9: { name: 'CMP', fn: () => this.cmp(this.readAbsoluteY), mode: 'absoluteY' },
        0xc1: { name: 'CMP', fn: () => this.cmp(this.readZeroPageXIndirect), mode: 'zeroPageXIndirect' },
        0xd1: { name: 'CMP', fn: () => this.cmp(this.readZeroPageIndirectY), mode: 'zeroPageIndirectY' },

        // CPX
        0xE0: { name: 'CPX', fn: () => this.cpx(this.readImmediate), mode: 'immediate' },
        0xE4: { name: 'CPX', fn: () => this.cpx(this.readZeroPage), mode: 'zeroPage' },
        0xEC: { name: 'CPX', fn: () => this.cpx(this.readAbsolute), mode: 'absolute' },

        // CPY
        0xC0: { name: 'CPY', fn: () => this.cpy(this.readImmediate), mode: 'immediate' },
        0xC4: { name: 'CPY', fn: () => this.cpy(this.readZeroPage), mode: 'zeroPage' },
        0xCC: { name: 'CPY', fn: () => this.cpy(this.readAbsolute), mode: 'absolute' },

        // BIT
        0x24: { name: 'BIT', fn: () => this.bit(this.readZeroPage), mode: 'zeroPage' },
        0x2C: { name: 'BIT', fn: () => this.bit(this.readAbsolute), mode: 'absolute' },

        // BCC
        0x90: { name: 'BCC', fn: () => this.brc(flags.C), mode: 'relative' },

        // BCS
        0xB0: { name: 'BCS', fn: () => this.brs(flags.C), mode: 'relative' },

        // BEQ
        0xF0: { name: 'BEQ', fn: () => this.brs(flags.Z), mode: 'relative' },

        // BMI
        0x30: { name: 'BMI', fn: () => this.brs(flags.N), mode: 'relative' },

        // BNE
        0xD0: { name: 'BNE', fn: () => this.brc(flags.Z), mode: 'relative' },

        // BPL
        0x10: { name: 'BPL', fn: () => this.brc(flags.N), mode: 'relative' },

        // BVC
        0x50: { name: 'BVC', fn: () => this.brc(flags.V), mode: 'relative' },

        // BVS
        0x70: { name: 'BVS', fn: () => this.brs(flags.V), mode: 'relative' },

        // TAX
        0xAA: { name: 'TAX', fn: () => this.tax(), mode: 'implied' },

        // TXA
        0x8A: { name: 'TXA', fn: () => this.txa(), mode: 'implied' },

        // TAY
        0xA8: { name: 'TAY', fn: () => this.tay(), mode: 'implied' },

        // TYA
        0x98: { name: 'TYA', fn: () => this.tya(), mode: 'implied' },

        // TSX
        0xBA: { name: 'TSX', fn: () => this.tsx(), mode: 'implied' },

        // TXS
        0x9A: { name: 'TXS', fn: () => this.txs(), mode: 'implied' },

        // PHA
        0x48: { name: 'PHA', fn: () => this.pha(), mode: 'implied' },

        // PLA
        0x68: { name: 'PLA', fn: () => this.pla(), mode: 'implied' },

        // PHP
        0x08: { name: 'PHP', fn: () => this.php(), mode: 'implied' },

        // PLP
        0x28: { name: 'PLP', fn: () => this.plp(), mode: 'implied' },

        // JMP
        0x4C: {
            name: 'JMP', fn: () => this.jmp(this.readAddrAbsolute), mode: 'absolute'
        },
        0x6C: {
            name: 'JMP', fn: () => this.jmp(this.readAddrAbsoluteIndirectBug), mode: 'absoluteIndirect'
        },
        // JSR
        0x20: { name: 'JSR', fn: () => this.jsr(), mode: 'absolute' },

        // RTS
        0x60: { name: 'RTS', fn: () => this.rts(), mode: 'implied' },

        // RTI
        0x40: { name: 'RTI', fn: () => this.rti(), mode: 'implied' },

        // SEC
        0x38: { name: 'SEC', fn: () => this.set(flags.C), mode: 'implied' },

        // SED
        0xF8: { name: 'SED', fn: () => this.set(flags.D), mode: 'implied' },

        // SEI
        0x78: { name: 'SEI', fn: () => this.set(flags.I), mode: 'implied' },

        // CLC
        0x18: { name: 'CLC', fn: () => this.clr(flags.C), mode: 'implied' },

        // CLD
        0xD8: { name: 'CLD', fn: () => this.clr(flags.D), mode: 'implied' },

        // CLI
        0x58: { name: 'CLI', fn: () => this.clr(flags.I), mode: 'implied' },

        // CLV
        0xB8: { name: 'CLV', fn: () => this.clr(flags.V), mode: 'implied' },

        // NOP
        0xea: { name: 'NOP', fn: () => this.nop(this.implied), mode: 'implied' },

        // BRK
        0x00: { name: 'BRK', fn: () => this.brk(this.readImmediate), mode: 'immediate' }
    };

    /* 65C02 Instructions */

    OPS_65C02: Instructions = {
        // INC / DEC A
        0x1A: { name: 'INC', fn: () => this.incA(), mode: 'accumulator' },
        0x3A: { name: 'DEC', fn: () => this.decA(), mode: 'accumulator' },

        // Indirect Zero Page for the masses
        0x12: { name: 'ORA', fn: () => this.ora(this.readZeroPageIndirect), mode: 'zeroPageIndirect' },
        0x32: { name: 'AND', fn: () => this.and(this.readZeroPageIndirect), mode: 'zeroPageIndirect' },
        0x52: { name: 'EOR', fn: () => this.eor(this.readZeroPageIndirect), mode: 'zeroPageIndirect' },
        0x72: { name: 'ADC', fn: () => this.adc(this.readZeroPageIndirect), mode: 'zeroPageIndirect' },
        0x92: { name: 'STA', fn: () => this.sta(this.writeZeroPageIndirect), mode: 'zeroPageIndirect' },
        0xB2: { name: 'LDA', fn: () => this.lda(this.readZeroPageIndirect), mode: 'zeroPageIndirect' },
        0xD2: { name: 'CMP', fn: () => this.cmp(this.readZeroPageIndirect), mode: 'zeroPageIndirect' },
        0xF2: { name: 'SBC', fn: () => this.sbc(this.readZeroPageIndirect), mode: 'zeroPageIndirect' },

        // Better BIT
        0x34: { name: 'BIT', fn: () => this.bit(this.readZeroPageX), mode: 'zeroPageX' },
        0x3C: { name: 'BIT', fn: () => this.bit(this.readAbsoluteX), mode: 'absoluteX' },
        0x89: { name: 'BIT', fn: () => this.bitI(this.readImmediate), mode: 'immediate' },

        // JMP absolute indirect indexed
        0x6C: {
            name: 'JMP', fn: () => this.jmp(this.readAddrAbsoluteIndirect), mode: 'absoluteIndirect'
        },
        0x7C: {
            name: 'JMP', fn: () => this.jmp(this.readAddrAbsoluteXIndirect), mode: 'absoluteXIndirect'
        },

        // BBR/BBS
        0x0F: { name: 'BBR0', fn: () => this.bbr(0), mode: 'zeroPage_relative' },
        0x1F: { name: 'BBR1', fn: () => this.bbr(1), mode: 'zeroPage_relative' },
        0x2F: { name: 'BBR2', fn: () => this.bbr(2), mode: 'zeroPage_relative' },
        0x3F: { name: 'BBR3', fn: () => this.bbr(3), mode: 'zeroPage_relative' },
        0x4F: { name: 'BBR4', fn: () => this.bbr(4), mode: 'zeroPage_relative' },
        0x5F: { name: 'BBR5', fn: () => this.bbr(5), mode: 'zeroPage_relative' },
        0x6F: { name: 'BBR6', fn: () => this.bbr(6), mode: 'zeroPage_relative' },
        0x7F: { name: 'BBR7', fn: () => this.bbr(7), mode: 'zeroPage_relative' },

        0x8F: { name: 'BBS0', fn: () => this.bbs(0), mode: 'zeroPage_relative' },
        0x9F: { name: 'BBS1', fn: () => this.bbs(1), mode: 'zeroPage_relative' },
        0xAF: { name: 'BBS2', fn: () => this.bbs(2), mode: 'zeroPage_relative' },
        0xBF: { name: 'BBS3', fn: () => this.bbs(3), mode: 'zeroPage_relative' },
        0xCF: { name: 'BBS4', fn: () => this.bbs(4), mode: 'zeroPage_relative' },
        0xDF: { name: 'BBS5', fn: () => this.bbs(5), mode: 'zeroPage_relative' },
        0xEF: { name: 'BBS6', fn: () => this.bbs(6), mode: 'zeroPage_relative' },
        0xFF: { name: 'BBS7', fn: () => this.bbs(7), mode: 'zeroPage_relative' },

        // BRA
        0x80: { name: 'BRA', fn: () => this.brc(0), mode: 'relative' },

        // NOP
        0x02: { name: 'NOP', fn: () => this.nop(this.readImmediate), mode: 'immediate' },
        0x22: { name: 'NOP', fn: () => this.nop(this.readImmediate), mode: 'immediate' },
        0x42: { name: 'NOP', fn: () => this.nop(this.readImmediate), mode: 'immediate' },
        0x44: { name: 'NOP', fn: () => this.nop(this.readZeroPage), mode: 'immediate' },
        0x54: { name: 'NOP', fn: () => this.nop(this.readZeroPageX), mode: 'immediate' },
        0x62: { name: 'NOP', fn: () => this.nop(this.readImmediate), mode: 'immediate' },
        0x82: { name: 'NOP', fn: () => this.nop(this.readImmediate), mode: 'immediate' },
        0xC2: { name: 'NOP', fn: () => this.nop(this.readImmediate), mode: 'immediate' },
        0xD4: { name: 'NOP', fn: () => this.nop(this.readZeroPageX), mode: 'immediate' },
        0xE2: { name: 'NOP', fn: () => this.nop(this.readImmediate), mode: 'immediate' },
        0xF4: { name: 'NOP', fn: () => this.nop(this.readZeroPageX), mode: 'immediate' },
        0x5C: { name: 'NOP', fn: () => this.nop(this.readNop), mode: 'absolute' },
        0xDC: { name: 'NOP', fn: () => this.nop(this.readNop), mode: 'absolute' },
        0xFC: { name: 'NOP', fn: () => this.nop(this.readNop), mode: 'absolute' },

        // PHX
        0xDA: { name: 'PHX', fn: () => this.phx(), mode: 'implied' },

        // PHY
        0x5A: { name: 'PHY', fn: () => this.phy(), mode: 'implied' },

        // PLX
        0xFA: { name: 'PLX', fn: () => this.plx(), mode: 'implied' },

        // PLY
        0x7A: { name: 'PLY', fn: () => this.ply(), mode: 'implied' },

        // RMB/SMB

        0x07: { name: 'RMB0', fn: () => this.rmb(0), mode: 'zeroPage' },
        0x17: { name: 'RMB1', fn: () => this.rmb(1), mode: 'zeroPage' },
        0x27: { name: 'RMB2', fn: () => this.rmb(2), mode: 'zeroPage' },
        0x37: { name: 'RMB3', fn: () => this.rmb(3), mode: 'zeroPage' },
        0x47: { name: 'RMB4', fn: () => this.rmb(4), mode: 'zeroPage' },
        0x57: { name: 'RMB5', fn: () => this.rmb(5), mode: 'zeroPage' },
        0x67: { name: 'RMB6', fn: () => this.rmb(6), mode: 'zeroPage' },
        0x77: { name: 'RMB7', fn: () => this.rmb(7), mode: 'zeroPage' },

        0x87: { name: 'SMB0', fn: () => this.smb(0), mode: 'zeroPage' },
        0x97: { name: 'SMB1', fn: () => this.smb(1), mode: 'zeroPage' },
        0xA7: { name: 'SMB2', fn: () => this.smb(2), mode: 'zeroPage' },
        0xB7: { name: 'SMB3', fn: () => this.smb(3), mode: 'zeroPage' },
        0xC7: { name: 'SMB4', fn: () => this.smb(4), mode: 'zeroPage' },
        0xD7: { name: 'SMB5', fn: () => this.smb(5), mode: 'zeroPage' },
        0xE7: { name: 'SMB6', fn: () => this.smb(6), mode: 'zeroPage' },
        0xF7: { name: 'SMB7', fn: () => this.smb(7), mode: 'zeroPage' },

        // STZ
        0x64: { name: 'STZ', fn: () => this.stz(this.writeZeroPage), mode: 'zeroPage' },
        0x74: { name: 'STZ', fn: () => this.stz(this.writeZeroPageX), mode: 'zeroPageX' },
        0x9C: { name: 'STZ', fn: () => this.stz(this.writeAbsolute), mode: 'absolute' },
        0x9E: { name: 'STZ', fn: () => this.stz(this.writeAbsoluteX), mode: 'absoluteX' },

        // TRB
        0x14: { name: 'TRB', fn: () => this.trb(this.readAddrZeroPage), mode: 'zeroPage' },
        0x1C: { name: 'TRB', fn: () => this.trb(this.readAddrAbsolute), mode: 'absolute' },

        // TSB
        0x04: { name: 'TSB', fn: () => this.tsb(this.readAddrZeroPage), mode: 'zeroPage' },
        0x0C: { name: 'TSB', fn: () => this.tsb(this.readAddrAbsolute), mode: 'absolute' }
    };

    OPS_NMOS_6502: Instructions = {
        // ASO
        0x0F: { name: 'ASO', fn: () => this.aso(this.readAddrAbsolute), mode: 'absolute' },
        0x1F: { name: 'ASO', fn: () => this.aso(this.readAddrAbsoluteX), mode: 'absoluteX' },
        0x1B: { name: 'ASO', fn: () => this.aso(this.readAddrAbsoluteY), mode: 'absoluteY' },
        0x07: { name: 'ASO', fn: () => this.aso(this.readAddrZeroPage), mode: 'zeroPage' },
        0x17: { name: 'ASO', fn: () => this.aso(this.readAddrZeroPageX), mode: 'zeroPageX' },
        0x03: { name: 'ASO', fn: () => this.aso(this.readAddrZeroPageXIndirect), mode: 'zeroPageXIndirect' },
        0x13: { name: 'ASO', fn: () => this.aso(this.readAddrZeroPageIndirectY), mode: 'zeroPageIndirectY' },

        // RLA
        0x2F: { name: 'RLA', fn: () => this.rla(this.readAddrAbsolute), mode: 'absolute' },
        0x3F: { name: 'RLA', fn: () => this.rla(this.readAddrAbsoluteX), mode: 'absoluteX' },
        0x3B: { name: 'RLA', fn: () => this.rla(this.readAddrAbsoluteY), mode: 'absoluteY' },
        0x27: { name: 'RLA', fn: () => this.rla(this.readAddrZeroPage), mode: 'zeroPage' },
        0x37: { name: 'RLA', fn: () => this.rla(this.readAddrZeroPageX), mode: 'zeroPageX' },
        0x23: { name: 'RLA', fn: () => this.rla(this.readAddrZeroPageXIndirect), mode: 'zeroPageXIndirect' },
        0x33: { name: 'RLA', fn: () => this.rla(this.readAddrZeroPageIndirectY), mode: 'zeroPageIndirectY' },

        // LSE
        0x4F: { name: 'LSE', fn: () => this.lse(this.readAddrAbsolute), mode: 'absolute' },
        0x5F: { name: 'LSE', fn: () => this.lse(this.readAddrAbsoluteX), mode: 'absoluteX' },
        0x5B: { name: 'LSE', fn: () => this.lse(this.readAddrAbsoluteY), mode: 'absoluteY' },
        0x47: { name: 'LSE', fn: () => this.lse(this.readAddrZeroPage), mode: 'zeroPage' },
        0x57: { name: 'LSE', fn: () => this.lse(this.readAddrZeroPageX), mode: 'zeroPageX' },
        0x43: { name: 'LSE', fn: () => this.lse(this.readAddrZeroPageXIndirect), mode: 'zeroPageXIndirect' },
        0x53: { name: 'LSE', fn: () => this.lse(this.readAddrZeroPageIndirectY), mode: 'zeroPageIndirectY' },

        // RRA
        0x6F: { name: 'RRA', fn: () => this.rra(this.readAddrAbsolute), mode: 'absolute' },
        0x7F: { name: 'RRA', fn: () => this.rra(this.readAddrAbsoluteX), mode: 'absoluteX' },
        0x7B: { name: 'RRA', fn: () => this.rra(this.readAddrAbsoluteY), mode: 'absoluteY' },
        0x67: { name: 'RRA', fn: () => this.rra(this.readAddrZeroPage), mode: 'zeroPage' },
        0x77: { name: 'RRA', fn: () => this.rra(this.readAddrZeroPageX), mode: 'zeroPageX' },
        0x63: { name: 'RRA', fn: () => this.rra(this.readAddrZeroPageXIndirect), mode: 'zeroPageXIndirect' },
        0x73: { name: 'RRA', fn: () => this.rra(this.readAddrZeroPageIndirectY), mode: 'zeroPageIndirectY' },

        // AXS
        0x8F: { name: 'AXS', fn: () => this.axs(this.writeAbsolute), mode: 'absolute'},
        0x87: { name: 'AXS', fn: () => this.axs(this.writeZeroPage), mode: 'zeroPage'},
        0x97: { name: 'AXS', fn: () => this.axs(this.writeZeroPageY), mode: 'zeroPageY'},
        0x83: { name: 'AXS', fn: () => this.axs(this.writeZeroPageXIndirect), mode: 'zeroPageXIndirect'},

        // LAX
        0xAF: { name: 'LAX', fn: () => this.lax(this.readAbsolute), mode: 'absolute'},
        0xBF: { name: 'LAX', fn: () => this.lax(this.readAbsoluteY), mode: 'absoluteY'},
        0xA7: { name: 'LAX', fn: () => this.lax(this.readZeroPage), mode: 'zeroPage'},
        0xB7: { name: 'LAX', fn: () => this.lax(this.readZeroPageY), mode: 'zeroPageY'},
        0xA3: { name: 'LAX', fn: () => this.lax(this.readZeroPageXIndirect), mode: 'zeroPageXIndirect'},
        0xB3: { name: 'LAX', fn: () => this.lax(this.readZeroPageIndirectY), mode: 'zeroPageIndirectY'},

        // DCM
        0xCF: { name: 'DCM', fn: () => this.dcm(this.readAddrAbsolute), mode: 'absolute' },
        0xDF: { name: 'DCM', fn: () => this.dcm(this.readAddrAbsoluteX), mode: 'absoluteX' },
        0xDB: { name: 'DCM', fn: () => this.dcm(this.readAddrAbsoluteY), mode: 'absoluteY' },
        0xC7: { name: 'DCM', fn: () => this.dcm(this.readAddrZeroPage), mode: 'zeroPage' },
        0xD7: { name: 'DCM', fn: () => this.dcm(this.readAddrZeroPageX), mode: 'zeroPageX' },
        0xC3: { name: 'DCM', fn: () => this.dcm(this.readAddrZeroPageXIndirect), mode: 'zeroPageXIndirect' },
        0xD3: { name: 'DCM', fn: () => this.dcm(this.readAddrZeroPageIndirectY), mode: 'zeroPageIndirectY' },

        // INS
        0xEF: { name: 'INS', fn: () => this.ins(this.readAddrAbsolute), mode: 'absolute' },
        0xFF: { name: 'INS', fn: () => this.ins(this.readAddrAbsoluteX), mode: 'absoluteX' },
        0xFB: { name: 'INS', fn: () => this.ins(this.readAddrAbsoluteY), mode: 'absoluteY' },
        0xE7: { name: 'INS', fn: () => this.ins(this.readAddrZeroPage), mode: 'zeroPage' },
        0xF7: { name: 'INS', fn: () => this.ins(this.readAddrZeroPageX), mode: 'zeroPageX' },
        0xE3: { name: 'INS', fn: () => this.ins(this.readAddrZeroPageXIndirect), mode: 'zeroPageXIndirect' },
        0xF3: { name: 'INS', fn: () => this.ins(this.readAddrZeroPageIndirectY), mode: 'zeroPageIndirectY' },

        // ALR
        0x4B: { name: 'ALR', fn: () => this.alr(this.readImmediate), mode: 'immediate' },

        // ARR
        0x6B: { name: 'ARR', fn: () => this.arr(this.readImmediate), mode: 'immediate' },

        // XAA
        0x8B: { name: 'XAA', fn: () => this.xaa(this.readImmediate), mode: 'immediate' },

        // OAL
        0xAB: { name: 'OAL', fn: () => this.oal(this.readImmediate), mode: 'immediate' },

        // SAX
        0xCB: { name: 'SAX', fn: () => this.sax(this.readImmediate), mode: 'immediate' },

        // NOP
        0x1a: { name: 'NOP', fn: () => this.nop(this.implied), mode: 'implied' },
        0x3a: { name: 'NOP', fn: () => this.nop(this.implied), mode: 'implied' },
        0x5a: { name: 'NOP', fn: () => this.nop(this.implied), mode: 'implied' },
        0x7a: { name: 'NOP', fn: () => this.nop(this.implied), mode: 'implied' },
        0xda: { name: 'NOP', fn: () => this.nop(this.implied), mode: 'implied' },
        0xfa: { name: 'NOP', fn: () => this.nop(this.implied), mode: 'implied' },

        // SKB
        0x80: { name: 'SKB', fn: () => this.skp(this.readImmediate), mode: 'immediate' },
        0x82: { name: 'SKB', fn: () => this.skp(this.readImmediate), mode: 'immediate' },
        0x89: { name: 'SKB', fn: () => this.skp(this.readImmediate), mode: 'immediate' },
        0xC2: { name: 'SKB', fn: () => this.skp(this.readImmediate), mode: 'immediate' },
        0xE2: { name: 'SKB', fn: () => this.skp(this.readImmediate), mode: 'immediate' },
        0x04: { name: 'SKB', fn: () => this.skp(this.readZeroPage), mode: 'zeroPage' },
        0x14: { name: 'SKB', fn: () => this.skp(this.readZeroPageX), mode: 'zeroPageX' },
        0x34: { name: 'SKB', fn: () => this.skp(this.readZeroPageX), mode: 'zeroPageX' },
        0x44: { name: 'SKB', fn: () => this.skp(this.readZeroPage), mode: 'zeroPage' },
        0x54: { name: 'SKB', fn: () => this.skp(this.readZeroPageX), mode: 'zeroPageX' },
        0x64: { name: 'SKB', fn: () => this.skp(this.readZeroPage), mode: 'zeroPage' },
        0x74: { name: 'SKB', fn: () => this.skp(this.readZeroPageX), mode: 'zeroPageX' },
        0xD4: { name: 'SKB', fn: () => this.skp(this.readZeroPageX), mode: 'zeroPageX' },
        0xF4: { name: 'SKB', fn: () => this.skp(this.readZeroPageX), mode: 'zeroPageX' },

        // SKW
        0x0C: { name: 'SKW', fn: () => this.skp(this.readAddrAbsolute), mode: 'absolute' },
        0x1C: { name: 'SKW', fn: () => this.skp(this.readAddrAbsoluteX), mode: 'absoluteX' },
        0x3C: { name: 'SKW', fn: () => this.skp(this.readAddrAbsoluteX), mode: 'absoluteX' },
        0x5C: { name: 'SKW', fn: () => this.skp(this.readAddrAbsoluteX), mode: 'absoluteX' },
        0x7C: { name: 'SKW', fn: () => this.skp(this.readAddrAbsoluteX), mode: 'absoluteX' },
        0xDC: { name: 'SKW', fn: () => this.skp(this.readAddrAbsoluteX), mode: 'absoluteX' },
        0xFC: { name: 'SKW', fn: () => this.skp(this.readAddrAbsoluteX), mode: 'absoluteX' },

        // HLT
        0x02: { name: 'HLT', fn: () => this.hlt(this.readNopImplied), mode: 'implied' },
        0x12: { name: 'HLT', fn: () => this.hlt(this.readNopImplied), mode: 'implied' },
        0x22: { name: 'HLT', fn: () => this.hlt(this.readNopImplied), mode: 'implied' },
        0x32: { name: 'HLT', fn: () => this.hlt(this.readNopImplied), mode: 'implied' },
        0x42: { name: 'HLT', fn: () => this.hlt(this.readNopImplied), mode: 'implied' },
        0x52: { name: 'HLT', fn: () => this.hlt(this.readNopImplied), mode: 'implied' },
        0x62: { name: 'HLT', fn: () => this.hlt(this.readNopImplied), mode: 'implied' },
        0x72: { name: 'HLT', fn: () => this.hlt(this.readNopImplied), mode: 'implied' },
        0x92: { name: 'HLT', fn: () => this.hlt(this.readNopImplied), mode: 'implied' },
        0xB2: { name: 'HLT', fn: () => this.hlt(this.readNopImplied), mode: 'implied' },
        0xD2: { name: 'HLT', fn: () => this.hlt(this.readNopImplied), mode: 'implied' },
        0xF2: { name: 'HLT', fn: () => this.hlt(this.readNopImplied), mode: 'implied' },

        // TAS
        0x9B: { name: 'TAS', fn: () => this.tas(this.readAddrAbsoluteY), mode: 'absoluteY'},

        // SAY
        0x9C: { name: 'SAY', fn: () => this.say(this.readAddrAbsoluteX), mode: 'absoluteX'},

        // XAS
        0x9E: { name: 'XAS', fn: () => this.xas(this.readAddrAbsoluteY), mode: 'absoluteY'},

        // AXA
        0x9F: { name: 'AXA', fn: () => this.axa(this.readAddrAbsoluteY), mode: 'absoluteY'},
        0x93: { name: 'AXA', fn: () => this.axa(this.readAddrZeroPageIndirectY), mode: 'zeroPageIndirectY'},

        // ANC
        0x2b: { name: 'ANC', fn: () => this.anc(this.readImmediate), mode: 'immediate' },
        0x0b: { name: 'ANC', fn: () => this.anc(this.readImmediate), mode: 'immediate' },

        // LAS
        0xBB: { name: 'LAS', fn: () => this.las(this.readAbsoluteY), mode: 'absoluteY'},

        // SBC
        0xEB: { name: 'SBC', fn: () => this.sbc(this.readImmediate), mode: 'immediate'}
    };

    OPS_ROCKWELL_65C02: Instructions = {
        0xCB: { name: 'NOP', fn: () => this.nop(this.implied), mode: 'implied' },
        0xDB: { name: 'NOP', fn: () => this.nop(this.readZeroPageX), mode: 'immediate' },
    };

    /* WDC 65C02 Instructions */

    OPS_WDC_65C02: Instructions = {
        0xCB: { name: 'WAI', fn: () => this.wai(), mode: 'implied' },
        0xDB: { name: 'STP', fn: () => this.stp(), mode: 'implied' }
    };
}
