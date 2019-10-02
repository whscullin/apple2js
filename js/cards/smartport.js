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

import { base64_decode } from '../base64';
import { debug, toHex } from '../util';

export default function SmartPort(io, slot, cpu) {

    /*
        $Cn01=$20
        $Cn03=$00
        $Cn05=$03
        $Cn07=$00
    */

    var ROM = [
        0xA2, 0x20, 0xA0, 0x00, 0xA2, 0x03, 0xA0, 0x3C, 0x20, 0x58, 0xFF, 0xBA, 0xBD, 0x00, 0x01, 0x0A,
        0x0A, 0x0A, 0x0A, 0xAA, 0x4C, 0x01, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x60, 0x00, 0x00, 0x60, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,

        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,

        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,

        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xDF, 0x20
    ];

    var disks = [];

    function decodeDisk(unit, disk) {
        disks[unit] = [];
        for (var idx = 0; idx < disk.blocks.length; idx++) {
            disks[unit][idx] = base64_decode(disk.blocks[idx]);
        }
    }

    function Address() {
        var lo;
        var hi;

        if (arguments.length == 1) {
            lo = arguments[0] & 0xff;
            hi = arguments[0] >> 8;
        } else if (arguments.length == 2) {
            lo = arguments[0];
            hi = arguments[1];
        }

        return {
            loByte: function() {
                return lo;
            },

            hiByte: function() {
                return hi;
            },

            inc: function(val) {
                return new Address(((hi << 8 | lo) + val) & 0xffff);
            },

            readByte: function() {
                return cpu.read(hi, lo);
            },

            readWord: function() {
                var readLo = this.readByte();
                var readHi = this.inc(1).readByte();

                return readHi << 8 | readLo;
            },

            readAddress: function() {
                var readLo = this.readByte();
                var readHi = this.inc(1).readByte();

                return new Address(readLo, readHi);
            },

            writeByte: function(val) {
                cpu.write(hi, lo, val);
            },

            writeWord: function(val) {
                this.writeByte(val & 0xff);
                this.inc(1).writeByte(val >> 8);
            },

            writeAddress: function(val) {
                this.writeByte(val.loByte());
                this.inc(1).writeByte(val.hiByte());
            },

            toString: function() {
                return '$' + toHex(hi) + toHex(lo);
            }
        };
    }

    /*
     * dumpBlock
     */
    /*
    function dumpBlock(drive, block) {
        var result = '';
        var b;
        var jdx;

        for (var idx = 0; idx < 32; idx++) {
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

    function getDeviceInfo(state, drive) {
        if (disks[drive]) {
            var blocks = disks[drive].length;
            state.x = blocks & 0xff;
            state.y = blocks >> 8;

            state.a = 0;
            state.s &= 0xfe;
        } else {
            state.a = 0x28;
            state.s |= 0x01;
        }
    }

    /*
     * readBlock
     */

    function readBlock(state, drive, block, buffer) {
        debug('read drive=' + drive);
        debug('read buffer=' + buffer);
        debug('read block=$' + toHex(block));

        if (!disks[drive] || !disks[drive].length) {
            debug('Drive', drive, 'is empty');
            return;
        }

        // debug('read', '\n' + dumpBlock(drive, block));

        for (var idx = 0; idx < 512; idx++) {
            buffer.writeByte(disks[drive][block][idx]);
            buffer = buffer.inc(1);
        }

        state.a = 0;
        state.s &= 0xfe;
    }

    /*
     * writeBlock
     */

    function writeBlock(state, drive, block, buffer) {
        debug('write drive=' + drive);
        debug('write buffer=' + buffer);
        debug('write block=$' + toHex(block));

        if (!disks[drive] || !disks[drive].length) {
            debug('Drive', drive, 'is empty');
            return;
        }

        // debug('write', '\n' + dumpBlock(drive, block));

        for (var idx = 0; idx < 512; idx++) {
            disks[drive][block][idx] = buffer.readByte();
            buffer = buffer.inc(1);
        }
        state.a = 0;
        state.s &= 0xfe;
    }

    /*
     * formatDevice
     */

    function formatDevice(state, drive) {
        for (var idx = 0; idx < disks[drive].length; idx++) {
            disks[drive][idx] = [];
            for (var jdx = 0; jdx < 512; jdx++) {
                disks[drive][idx][jdx] = 0;
            }
        }

        state.a = 0;
        state.s &= 0xfe;
    }

    /*
     * Interface
     */

    return {
        read: function(page, off, debugFlag) {
            var state = cpu.getState();
            var cmd;
            var unit;
            var buffer;
            var block;

            if (!debugFlag) {
                debug('read $' + toHex(page) + toHex(off) + '=$' + toHex(ROM[off]), cpu.sync());
            }

            if (off == 0x00 && cpu.sync()) {
                readBlock(state, 1, 0, new Address(0x0800));
            } else if (off == 0x20 && cpu.sync()) { // Regular block device entry POINT
                debug('block device entry');
                cmd = cpu.read(0x00, 0x42);
                unit = cpu.read(0x00, 0x43);
                var bufferAddr;
                var blockAddr;
                var drive = (unit & 0x80) ? 2 : 1;
                var driveSlot = (unit & 0x70) >> 4;

                debug('cmd=' + cmd);
                debug('unit=$' + toHex(unit));

                debug('slot=' + driveSlot + ' drive=' + drive);

                switch (cmd) {
                case 0: // INFO
                    getDeviceInfo(state, drive);
                    break;

                case 1: // READ
                    bufferAddr = new Address(0x44);
                    buffer = bufferAddr.readAddress();
                    blockAddr = new Address(0x46);
                    block = blockAddr.readWord();

                    readBlock(state, drive, block, buffer);
                    break;

                case 2: // WRITE
                    bufferAddr = new Address(0x44);
                    buffer = bufferAddr.readAddress();
                    blockAddr = new Address(0x46);
                    block = blockAddr.readWord();

                    writeBlock(state, drive, block, buffer);
                    break;
                case 3: // FORMAT
                    formatDevice(state, unit);
                    break;
                }
            } else if (off == 0x23 && cpu.sync()) {
                debug('smartport entry');
                var retVal = {};
                var stackAddr = new Address(state.sp + 1, 0x01);

                retVal = stackAddr.readAddress();

                debug('return=' + retVal);

                var cmdBlockAddr = retVal.inc(1);
                cmd = cmdBlockAddr.readByte();
                var cmdListAddr = cmdBlockAddr.inc(1).readAddress();

                debug('cmd=' + cmd);
                debug('cmdListAddr=' + cmdListAddr);

                stackAddr.writeAddress(retVal.inc(3));

                var parameterCount = cmdListAddr.readByte();
                unit = cmdListAddr.inc(1).readByte();
                buffer = cmdListAddr.inc(2).readAddress();
                var status;

                debug('parameterCount=' + parameterCount);
                switch (cmd) {
                case 0x00: // INFO
                    status = cmdListAddr.inc(4).readByte();
                    debug('info unit=' + unit);
                    debug('info buffer=' + buffer);
                    debug('info status=' + status);
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
                            var blocks = disks[unit].length;
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
                    readBlock(state, unit, block, buffer);
                    break;

                case 0x02: // WRITE BLOCK
                    block = cmdListAddr.inc(4).readWord();
                    writeBlock(state, unit, block, buffer);
                    break;

                case 0x03: // FORMAT
                    formatDevice(state, unit);
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

            cpu.setState(state);

            return ROM[off];
        },

        write: function() {
        },

        getState: function() {
        },

        setState: function() {
        },

        setBinary: function (drive, name, fmt, data) {
            disks[drive] = [];
            if (fmt == '2mg') {
                data = data.slice(64);
            }
            for (var idx = 0; idx < data.byteLength; idx += 512) {
                disks[drive].push(new Uint8Array(data.slice(idx, idx + 512)));
            }
        },

        setDisk: function(drive, json) {
            decodeDisk(drive, json);
        }
    };
}
