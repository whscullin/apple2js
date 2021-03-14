/* Copyright 2010-2019 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

import { debug, toHex } from '../util';
import { rom as smartPortRom } from '../roms/cards/smartport';
import { Card, Restorable, byte, word, rom } from '../types';
import CPU6502, { CpuState, flags } from '../cpu6502';

type SmartDisk = Uint8Array[];

interface BlockDevice {
    blocks: Uint8Array
}

export interface SmartPortState {
    disks: SmartDisk[]
}

export interface SmartPortOptions {
    block: boolean;
}

class Address {
    lo: byte;
    hi: byte;

    constructor(private cpu: CPU6502, a: byte | word, b?: byte) {
        if (b === undefined) {
            this.lo = a & 0xff;
            this.hi = a >> 8;
        } else {
            this.lo = a;
            this.hi = b;
        }
    }

    loByte() {
        return this.lo;
    }

    hiByte() {
        return this.hi;
    }

    inc(val: byte) {
        return new Address(this.cpu, ((this.hi << 8 | this.lo) + val) & 0xffff);
    }

    readByte() {
        return this.cpu.read(this.hi, this.lo);
    }

    readWord() {
        const readLo = this.readByte();
        const readHi = this.inc(1).readByte();

        return readHi << 8 | readLo;
    }

    readAddress() {
        const readLo = this.readByte();
        const readHi = this.inc(1).readByte();

        return new Address(this.cpu, readLo, readHi);
    }

    writeByte(val: byte) {
        this.cpu.write(this.hi, this.lo, val);
    }

    writeWord(val: word) {
        this.writeByte(val & 0xff);
        this.inc(1).writeByte(val >> 8);
    }

    writeAddress(val: Address) {
        this.writeByte(val.loByte());
        this.inc(1).writeByte(val.hiByte());
    }

    toString() {
        return '$' + toHex(this.hi) + toHex(this.lo);
    }
}

// ProDOS zero page locations

const COMMAND = 0x42;
const UNIT = 0x43;
const ADDRESS_LO = 0x44;
// const ADDRESS_HI = 0x45;
const BLOCK_LO = 0x46;
// const BLOCK_HI = 0x47;

export default class SmartPort implements Card, Restorable<SmartPortState> {

    private rom: rom;
    private disks: SmartDisk[] = [];

    constructor(private cpu: CPU6502, options: SmartPortOptions) {
        if (options?.block) {
            const dumbPortRom =  new Uint8Array(smartPortRom);
            dumbPortRom[0x07] = 0x3C;
            this.rom = dumbPortRom;
            debug('DumbPort card');
        } else {
            debug('SmartPort card');
            this.rom = smartPortRom;
        }
    }

    private decodeDisk(unit: number, disk: BlockDevice) {
        this.disks[unit] = [];
        for (let idx = 0; idx < disk.blocks.length; idx++) {
            this.disks[unit][idx] = new Uint8Array(disk.blocks[idx]);
        }
    }

    private debug(..._args: any[]) {
        // debug.apply(this, arguments);
    }

    /*
     * dumpBlock
     */
    /*
    dumpBlock(drive, block) {
        const result = '';
        const b;
        const jdx;

        for (const idx = 0; idx < 32; idx++) {
            result += toHex(idx << 4, 4) + ': ';
            for (jdx = 0; jdx < 16; jdx++) {
                b = disks[drive][block][idx * 16 + jdx];
                if (jdx == 8) {
                    result += ' ';
                }
                result += toHex(b) + ' ';
            }
            result += '        ';
            for (jdx = 0; jdx < 16; jdx++) {
                b = disks[drive][block][idx * 16 + jdx] & 0x7f;
                if (jdx == 8) {
                    result += ' ';
                }
                if (b >= 0x20 && b < 0x7f) {
                    result += String.fromCharCode(b);
                } else {
                    result += '.';
                }
            }
            result += '\n';
        }
        return result;
    }
*/
    /*
     * getDeviceInfo
     */

    getDeviceInfo(state: CpuState, drive: number) {
        if (this.disks[drive]) {
            const blocks = this.disks[drive].length;
            state.x = blocks & 0xff;
            state.y = blocks >> 8;

            state.a = 0;
            state.s &= ~flags.C;
        } else {
            state.a = 0x28;
            state.s |= flags.C;
        }
    }

    /*
     * readBlock
     */

    readBlock(state: CpuState, drive: number, block: number, buffer: Address) {
        this.debug('read drive=' + drive);
        this.debug('read buffer=' + buffer);
        this.debug('read block=$' + toHex(block));

        if (!this.disks[drive] || !this.disks[drive].length) {
            debug('Drive', drive, 'is empty');
            return;
        }

        // debug('read', '\n' + dumpBlock(drive, block));

        for (let idx = 0; idx < 512; idx++) {
            buffer.writeByte(this.disks[drive][block][idx]);
            buffer = buffer.inc(1);
        }

        state.a = 0;
        state.s &= 0xfe;
    }

    /*
     * writeBlock
     */

    writeBlock(state: CpuState, drive: number, block: number, buffer: Address) {
        this.debug('write drive=' + drive);
        this.debug('write buffer=' + buffer);
        this.debug('write block=$' + toHex(block));

        if (!this.disks[drive] || !this.disks[drive].length) {
            debug('Drive', drive, 'is empty');
            return;
        }

        // debug('write', '\n' + dumpBlock(drive, block));

        for (let idx = 0; idx < 512; idx++) {
            this.disks[drive][block][idx] = buffer.readByte();
            buffer = buffer.inc(1);
        }
        state.a = 0;
        state.s &= 0xfe;
    }

    /*
     * formatDevice
     */

    formatDevice(state: CpuState, drive: number) {
        for (let idx = 0; idx < this.disks[drive].length; idx++) {
            this.disks[drive][idx] = new Uint8Array();
            for (let jdx = 0; jdx < 512; jdx++) {
                this.disks[drive][idx][jdx] = 0;
            }
        }

        state.a = 0;
        state.s &= 0xfe;
    }

    private access(off: byte, val: byte) {
        let result;
        const readMode = val === undefined;

        switch (off & 0x8f) {
            case 0x80:
                if (readMode) {
                    result = 0;
                    for (let idx = 0; idx < this.disks.length; idx++) {
                        result <<= 1;
                        if (this.disks[idx]) {
                            result |= 0x01;
                        }
                    }
                }
                break;
        }

        return result;
    }

    /*
     * Interface
     */

    ioSwitch(off: byte, val: byte) {
        return this.access(off, val);
    }

    read(_page: byte, off: byte) {
        const state = this.cpu.getState();
        let cmd;
        let unit;
        let buffer;
        let block;
        const blockOff = this.rom[0xff];
        const smartOff = blockOff + 3;

        if (off === blockOff && this.cpu.getSync()) { // Regular block device entry POINT
            this.debug('block device entry');
            cmd = this.cpu.read(0x00, COMMAND);
            unit = this.cpu.read(0x00, UNIT);
            const bufferAddr = new Address(this.cpu, ADDRESS_LO);
            const blockAddr = new Address(this.cpu, BLOCK_LO);
            const drive = (unit & 0x80) ? 2 : 1;
            const driveSlot = (unit & 0x70) >> 4;

            buffer = bufferAddr.readAddress();
            block = blockAddr.readWord();

            this.debug('cmd=' + cmd);
            this.debug('unit=$' + toHex(unit));

            this.debug('slot=' + driveSlot + ' drive=' + drive);
            this.debug('buffer=' + buffer + ' block=$' + toHex(block));

            switch (cmd) {
                case 0: // INFO
                    this.getDeviceInfo(state, drive);
                    break;

                case 1: // READ
                    this.readBlock(state, drive, block, buffer);
                    break;

                case 2: // WRITE
                    this.writeBlock(state, drive, block, buffer);
                    break;

                case 3: // FORMAT
                    this.formatDevice(state, unit);
                    break;
            }
        } else if (off == smartOff && this.cpu.getSync()) {
            this.debug('smartport entry');
            const stackAddr = new Address(this.cpu, state.sp + 1, 0x01);
            let blocks;

            const retVal = stackAddr.readAddress();

            this.debug('return=' + retVal);

            const cmdBlockAddr = retVal.inc(1);
            cmd = cmdBlockAddr.readByte();
            const cmdListAddr = cmdBlockAddr.inc(1).readAddress();

            this.debug('cmd=' + cmd);
            this.debug('cmdListAddr=' + cmdListAddr);

            stackAddr.writeAddress(retVal.inc(3));

            const parameterCount = cmdListAddr.readByte();
            unit = cmdListAddr.inc(1).readByte();
            buffer = cmdListAddr.inc(2).readAddress();
            let status;

            this.debug('parameterCount=' + parameterCount);
            switch (cmd) {
                case 0x00: // INFO
                    status = cmdListAddr.inc(4).readByte();
                    this.debug('info unit=' + unit);
                    this.debug('info buffer=' + buffer);
                    this.debug('info status=' + status);
                    switch (unit) {
                        case 0:
                            switch (status) {
                                case 0:
                                    buffer.writeByte(1); // one device
                                    buffer.inc(1).writeByte(1 << 6); // no interrupts
                                    buffer.inc(2).writeByte(0); // reserved
                                    buffer.inc(3).writeByte(0); // reserved
                                    buffer.inc(4).writeByte(0); // reserved
                                    buffer.inc(5).writeByte(0); // reserved
                                    buffer.inc(6).writeByte(0); // reserved
                                    buffer.inc(7).writeByte(0); // reserved
                                    state.x = 8;
                                    state.y = 0;
                                    state.a = 0;
                                    state.s &= 0xfe;
                                    break;
                            }
                            break;
                        default: // Unit 1
                            switch (status) {
                                case 0:
                                    blocks = this.disks[unit].length;
                                    buffer.writeByte(0xf0); // W/R Block device in drive
                                    buffer.inc(1).writeByte(blocks & 0xff); // 1600 blocks
                                    buffer.inc(2).writeByte((blocks & 0xff00) >> 8);
                                    buffer.inc(3).writeByte((blocks & 0xff0000) >> 16);
                                    state.x = 4;
                                    state.y = 0;
                                    state.a = 0;
                                    state.s &= 0xfe;
                                    break;
                            }
                            break;
                    }
                    state.a = 0;
                    state.s &= 0xfe;
                    break;

                case 0x01: // READ BLOCK
                    block = cmdListAddr.inc(4).readWord();
                    this.readBlock(state, unit, block, buffer);
                    break;

                case 0x02: // WRITE BLOCK
                    block = cmdListAddr.inc(4).readWord();
                    this.writeBlock(state, unit, block, buffer);
                    break;

                case 0x03: // FORMAT
                    this.formatDevice(state, unit);
                    break;

                case 0x04: // CONTROL
                    break;

                case 0x05: // INIT
                    break;

                case 0x06: // OPEN
                    break;

                case 0x07: // CLOSE
                    break;

                case 0x08: // READ
                    break;

                case 0x09: // WRITE
                    break;
            }
        }

        this.cpu.setState(state);

        return this.rom[off];
    }

    write() {
    }

    getState() {
        return {
            disks: this.disks.map(
                (disk) => disk.map(
                    (block) => new Uint8Array(block)
                )
            )
        };
    }

    setState(state: SmartPortState) {
        this.disks = state.disks.map(
            (disk) => disk.map(
                (block) => new Uint8Array(block)
            )
        );
    }

    setBinary(drive: number, _name: string, fmt: string, data: ArrayBuffer) {
        this.disks[drive] = [];
        if (fmt == '2mg') {
            data = data.slice(64);
        }
        for (let idx = 0; idx < data.byteLength; idx += 512) {
            this.disks[drive].push(new Uint8Array(data.slice(idx, idx + 512)));
        }
    }

    setDisk(drive: number, json: BlockDevice) {
        this.decodeDisk(drive, json);
    }
}
