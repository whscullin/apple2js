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
import { rom } from '../roms/cards/smartport';

export default function SmartPort(io, cpu, options ) {
    var COMMAND = 0x42;
    var UNIT = 0x43;
    var ADDRESS_LO = 0x44;
    // var ADDRESS_HI = 0x45;
    var BLOCK_LO = 0x46;
    // var BLOCK_HI = 0x47;


    var disks = [];

    function _init() {
        if (options && options.block) {
            rom[0x07] = 0x3C;
            debug('DumbPort card');
        } else {
            debug('SmartPort card');
        }
    }

    function decodeDisk(unit, disk) {
        disks[unit] = [];
        for (var idx = 0; idx < disk.blocks.length; idx++) {
            disks[unit][idx] = base64_decode(disk.blocks[idx]);
        }
    }

    function _debug() {
        // debug.apply(this, arguments);
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
        _debug('read drive=' + drive);
        _debug('read buffer=' + buffer);
        _debug('read block=$' + toHex(block));

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
        _debug('write drive=' + drive);
        _debug('write buffer=' + buffer);
        _debug('write block=$' + toHex(block));

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

    function _access(off, val) {
        var result;
        var readMode = val === undefined;

        switch (off & 0x8f) {
            case 0x80:
                if (readMode) {
                    result = 0;
                    for (var idx = 0; idx < disks.length; idx++) {
                        result <<= 1;
                        if (disks[idx]) {
                            result |= 0x01;
                        }
                    }
                }
                break;
        }

        return result;
    }

    _init();

    /*
     * Interface
     */

    return {
        ioSwitch: function (off, val) {
            return _access(off, val);
        },

        read: function(page, off) {
            var state = cpu.getState();
            var cmd;
            var unit;
            var buffer;
            var block;
            var blockOff = rom[0xff];
            var smartOff = blockOff + 3;

            if (off === blockOff && cpu.getSync()) { // Regular block device entry POINT
                _debug('block device entry');
                cmd = cpu.read(0x00, COMMAND);
                unit = cpu.read(0x00, UNIT);
                var bufferAddr = new Address(ADDRESS_LO);
                var blockAddr = new Address(BLOCK_LO);
                var drive = (unit & 0x80) ? 2 : 1;
                var driveSlot = (unit & 0x70) >> 4;

                buffer = bufferAddr.readAddress();
                block = blockAddr.readWord();

                _debug('cmd=' + cmd);
                _debug('unit=$' + toHex(unit));

                _debug('slot=' + driveSlot + ' drive=' + drive);
                _debug('buffer=' + toHex(buffer) + ' block=' + toHex(block));

                switch (cmd) {
                    case 0: // INFO
                        getDeviceInfo(state, drive);
                        break;

                    case 1: // READ
                        readBlock(state, drive, block, buffer);
                        break;

                    case 2: // WRITE
                        writeBlock(state, drive, block, buffer);
                        break;

                    case 3: // FORMAT
                        formatDevice(state, unit);
                        break;
                }
            } else if (off == smartOff && cpu.getSync()) {
                _debug('smartport entry');
                var retVal = {};
                var stackAddr = new Address(state.sp + 1, 0x01);

                retVal = stackAddr.readAddress();

                _debug('return=' + retVal);

                var cmdBlockAddr = retVal.inc(1);
                cmd = cmdBlockAddr.readByte();
                var cmdListAddr = cmdBlockAddr.inc(1).readAddress();

                _debug('cmd=' + cmd);
                _debug('cmdListAddr=' + cmdListAddr);

                stackAddr.writeAddress(retVal.inc(3));

                var parameterCount = cmdListAddr.readByte();
                unit = cmdListAddr.inc(1).readByte();
                buffer = cmdListAddr.inc(2).readAddress();
                var status;

                _debug('parameterCount=' + parameterCount);
                switch (cmd) {
                    case 0x00: // INFO
                        status = cmdListAddr.inc(4).readByte();
                        _debug('info unit=' + unit);
                        _debug('info buffer=' + buffer);
                        _debug('info status=' + status);
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

            return rom[off];
        },

        write: function() {
        },

        getState: function() {
            // TODO: Smartport State
            return {};
        },

        setState: function(_) {
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
