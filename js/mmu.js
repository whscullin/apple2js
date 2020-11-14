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

import RAM from './ram';
import { debug, toHex } from './util';

export default function MMU(cpu, vm, lores1, lores2, hires1, hires2, io, rom)
{
    var idx;

    var _readPages = new Array(0x100);
    var _writePages = new Array(0x100);
    var _pages = new Array(0x100);

    // Language Card RAM Softswitches
    var _bank1;
    var _readbsr;
    var _writebsr;
    var _prewrite;

    // Auxillary ROM
    var _intcxrom;
    var _slot3rom;
    var _intc8rom;

    // Auxillary RAM
    var _auxRamRead;
    var _auxRamWrite;
    var _altzp;

    // Video
    var _80store;
    var _page2;
    var _hires;

    var _iouDisable;

    var _vbEnd = 0;

    /*
     * I/O Switch locations
     */

    var LOC = {
        // 80 Column
        _80STOREOFF: 0x00,
        _80STOREON: 0x01,

        // Aux RAM
        RAMRDOFF: 0x02,
        RAMRDON: 0x03,

        RAMWROFF: 0x04,
        RAMWRON: 0x05,

        // Bank switched ROM
        INTCXROMOFF: 0x06,
        INTCXROMON: 0x07,
        ALTZPOFF: 0x08,
        ALTZPON: 0x09,
        SLOTC3ROMOFF: 0x0A,
        SLOTC3ROMON: 0x0B,

        CLR80VID: 0x0C, // clear 80 column mode
        SET80VID: 0x0D, // set 80 column mode
        CLRALTCH: 0x0E, // clear mousetext
        SETALTCH: 0x0F, // set mousetext

        // Status
        BSRBANK2: 0x11,
        BSRREADRAM: 0x12,
        RAMRD: 0x13,
        RAMWRT: 0x14,
        INTCXROM: 0x15,
        ALTZP: 0x16,
        SLOTC3ROM: 0x17,
        _80STORE: 0x18,
        VERTBLANK: 0x19,

        RDTEXT:   0x1A, // using text mode
        RDMIXED:  0x1B, // using mixed mode
        RDPAGE2:  0x1C, // using text/graphics page2
        RDHIRES:  0x1D, // using Hi-res graphics mode
        RDALTCH:  0x1E, // using alternate character set
        RD80VID:  0x1F, // using 80-column display mode

        PAGE1: 0x54, // select text/graphics page1 main/aux
        PAGE2: 0x55, // select text/graphics page2 main/aux
        RESET_HIRES: 0x56,
        SET_HIRES: 0x57,

        DHIRESON: 0x5E, // Enable double hires
        DHIRESOFF: 0x5F, // Disable double hires

        BANK:     0x73, // Back switched RAM card bank

        IOUDISON: 0x7E, // W IOU Disable on / R7 IOU Disable
        IOUDISOFF: 0x7F, // W IOU Disable off / R7 Double Hires

        // Bank 2
        READBSR2: 0x80,
        WRITEBSR2: 0x81,
        OFFBSR2: 0x82,
        READWRBSR2: 0x83,

        // Shadow Bank 2
        _READBSR2: 0x84,
        _WRITEBSR2: 0x85,
        _OFFBSR2: 0x86,
        _READWRBSR2: 0x87,

        // Bank 1
        READBSR1: 0x88,
        WRITEBSR1: 0x89,
        OFFBSR1: 0x8a,
        READWRBSR1: 0x8b,

        // Shadow Bank 1
        _READBSR1: 0x8c,
        _WRITEBSR1: 0x8d,
        _OFFBSR1: 0x8e,
        _READWRBSR1: 0x8f
    };

    function _initSwitches() {
        _bank1 = true;
        _readbsr = false;
        _writebsr = false;
        _prewrite = false;

        _auxRamRead = false;
        _auxRamWrite = false;
        _altzp = false;

        _intcxrom = false;
        _slot3rom = false;
        _intc8rom = false;

        _80store = false;
        _page2 = false;
        _hires = false;

        _iouDisable = true;
    }

    function _debug() {
        // debug.apply(this, arguments);
    }

    function Switches() {
        var locs = {};

        Object.keys(LOC).forEach(function(loc) {
            locs[LOC[loc]] = loc;
        });

        return {
            start: function() {
                return 0xC0;
            },
            end: function() {
                return 0xC0;
            },
            read: function(page, off) {
                var result;
                if (off in locs) {
                    result = _access(off);
                } else {
                    result = io.ioSwitch(off, undefined);
                }
                return result;
            },
            write: function(page, off, val) {
                if (off in locs) {
                    _access(off, val);
                } else {
                    io.ioSwitch(off, val);
                }
            }
        };
    }

    function AuxRom() {
        return {
            read: function(page, off) {
                if (page == 0xc3) {
                    _intc8rom = true;
                    _updateBanks();
                }
                if (page == 0xcf && off == 0xff) {
                    _intc8rom = false;
                    _updateBanks();
                }
                return rom.read(page, off);
            },
            write: function() {}
        };
    }

    var switches = new Switches();
    var auxRom = new AuxRom();

    var mem00_01 = [new RAM(0x0, 0x1), new RAM(0x0, 0x1)];
    var mem02_03 = [new RAM(0x2, 0x3), new RAM(0x2, 0x3)];
    var mem04_07 = [lores1.bank0(), lores1.bank1()];
    var mem08_0B = [lores2.bank0(), lores2.bank1()];
    var mem0C_1F = [new RAM(0xC, 0x1F), new RAM(0xC, 0x1F)];
    var mem20_3F = [hires1.bank0(), hires1.bank1()];
    var mem40_5F = [hires2.bank0(), hires2.bank1()];
    var mem60_BF = [new RAM(0x60,0xBF), new RAM(0x60,0xBF)];
    var memC0_C0 = [switches];
    var memC1_CF = [io, auxRom];
    var memD0_DF = [
        rom,
        new RAM(0xD0,0xDF), new RAM(0xD0,0xDF),
        new RAM(0xD0,0xDF), new RAM(0xD0,0xDF)
    ];
    var memE0_FF = [rom, new RAM(0xE0,0xFF), new RAM(0xE0,0xFF)];

    /*
     * Initialize read/write banks
     */

    // Zero Page/Stack
    for (idx = 0x0; idx < 0x2; idx++) {
        _pages[idx] = mem00_01;
        _readPages[idx] = _pages[idx][0];
        _writePages[idx] = _pages[idx][0];
    }
    // 0x300-0x400
    for (idx = 0x2; idx < 0x4; idx++) {
        _pages[idx] = mem02_03;
        _readPages[idx] = _pages[idx][0];
        _writePages[idx] = _pages[idx][0];
    }
    // Text Page 1
    for (idx = 0x4; idx < 0x8; idx++) {
        _pages[idx] = mem04_07;
        _readPages[idx] = _pages[idx][0];
        _writePages[idx] = _pages[idx][0];
    }
    // Text Page 2
    for (idx = 0x8; idx < 0xC; idx++) {
        _pages[idx] = mem08_0B;
        _readPages[idx] = _pages[idx][0];
        _writePages[idx] = _pages[idx][0];
    }
    // 0xC00-0x2000
    for (idx = 0xC; idx < 0x20; idx++) {
        _pages[idx] = mem0C_1F;
        _readPages[idx] = _pages[idx][0];
        _writePages[idx] = _pages[idx][0];
    }
    // Hires Page 1
    for (idx = 0x20; idx < 0x40; idx++) {
        _pages[idx] = mem20_3F;
        _readPages[idx] = _pages[idx][0];
        _writePages[idx] = _pages[idx][0];
    }
    // Hires Page 2
    for (idx = 0x40; idx < 0x60; idx++) {
        _pages[idx] = mem40_5F;
        _readPages[idx] = _pages[idx][0];
        _writePages[idx] = _pages[idx][0];
    }
    // 0x6000-0xc000
    for (idx = 0x60; idx < 0xc0; idx++) {
        _pages[idx] = mem60_BF;
        _readPages[idx] = _pages[idx][0];
        _writePages[idx] = _pages[idx][0];
    }
    // I/O Switches
    idx = 0xc0;
    _pages[idx] = memC0_C0;
    _readPages[idx] = _pages[idx][0];
    _writePages[idx] = _pages[idx][0];
    // Slots
    for (idx = 0xc1; idx < 0xd0; idx++) {
        _pages[idx] = memC1_CF;
        _readPages[idx] = _pages[idx][0];
        _writePages[idx] = _pages[idx][0];
    }
    // Basic ROM
    for (idx = 0xd0; idx < 0xe0; idx++) {
        _pages[idx] = memD0_DF;
        _readPages[idx] = _pages[idx][0];
        _writePages[idx] = _pages[idx][0];
    }
    // Monitor ROM
    for (idx = 0xe0; idx < 0x100; idx++) {
        _pages[idx] = memE0_FF;
        _readPages[idx] = _pages[idx][0];
        _writePages[idx] = _pages[idx][0];
    }

    function _updateBanks() {
        if (_auxRamRead) {
            for (idx = 0x02; idx < 0xC0; idx++) {
                _readPages[idx] = _pages[idx][1];
            }
        } else {
            for (idx = 0x02; idx < 0xC0; idx++) {
                _readPages[idx] = _pages[idx][0];
            }
        }

        if (_auxRamWrite) {
            for (idx = 0x02; idx < 0xC0; idx++) {
                _writePages[idx] = _pages[idx][1];
            }
        } else {
            for (idx = 0x02; idx < 0xC0; idx++) {
                _writePages[idx] = _pages[idx][0];
            }
        }

        if (_80store) {
            if (_page2) {
                for (idx = 0x4; idx < 0x8; idx++) {
                    _readPages[idx] = _pages[idx][1];
                    _writePages[idx] = _pages[idx][1];
                }
                if (_hires) {
                    for (idx = 0x20; idx < 0x40; idx++) {
                        _readPages[idx] = _pages[idx][1];
                        _writePages[idx] = _pages[idx][1];
                    }
                }
            } else {
                for (idx = 0x4; idx < 0x8; idx++) {
                    _readPages[idx] = _pages[idx][0];
                    _writePages[idx] = _pages[idx][0];
                }
                if (_hires) {
                    for (idx = 0x20; idx < 0x40; idx++) {
                        _readPages[idx] = _pages[idx][0];
                        _writePages[idx] = _pages[idx][0];
                    }
                }
            }
        }

        if (_intcxrom) {
            for (idx = 0xc1; idx < 0xd0; idx++) {
                _readPages[idx] = _pages[idx][1];
            }
        } else {
            for (idx = 0xc1; idx < 0xd0; idx++) {
                _readPages[idx] = _pages[idx][0];
            }
            if (!_slot3rom) {
                _readPages[0xc3] = _pages[0xc3][1];
            }
            if (_intc8rom) {
                for (idx = 0xc8; idx < 0xd0; idx++) {
                    _readPages[idx] = _pages[idx][1];
                }
            }
        }

        if (_altzp) {
            for (idx = 0x0; idx < 0x2; idx++) {
                _readPages[idx] = _pages[idx][1];
                _writePages[idx] = _pages[idx][1];
            }
        } else {
            for (idx = 0x0; idx < 0x2; idx++) {
                _readPages[idx] = _pages[idx][0];
                _writePages[idx] = _pages[idx][0];
            }
        }

        if (_readbsr) {
            if (_bank1) {
                for (idx = 0xd0; idx < 0xe0; idx++) {
                    _readPages[idx] = _pages[idx][_altzp ? 2 : 1];
                }
            } else {
                for (idx = 0xd0; idx < 0xe0; idx++) {
                    _readPages[idx] = _pages[idx][_altzp ? 4 : 3];
                }
            }
            for (idx = 0xe0; idx < 0x100; idx++) {
                _readPages[idx] = _pages[idx][_altzp ? 2 : 1];
            }
        } else {
            for (idx = 0xd0; idx < 0x100; idx++) {
                _readPages[idx] = _pages[idx][0];
            }
        }

        if (_writebsr) {
            if (_bank1) {
                for (idx = 0xd0; idx < 0xe0; idx++) {
                    _writePages[idx] = _pages[idx][_altzp ? 2 : 1];
                }
            } else {
                for (idx = 0xd0; idx < 0xe0; idx++) {
                    _writePages[idx] = _pages[idx][_altzp ? 4 : 3];
                }
            }
            for (idx = 0xe0; idx < 0x100; idx++) {
                _writePages[idx] = _pages[idx][_altzp ? 2 : 1];
            }
        } else {
            for (idx = 0xd0; idx < 0x100; idx++) {
                _writePages[idx] = _pages[idx][0];
            }
        }
    }

    /*
     * The Big Switch
     */

    function _access(off, val) {
        var result;
        var readMode = val === undefined;
        var writeMode = val !== undefined;
        switch (off) {

        // Apple //e memory management

        case LOC._80STOREOFF:
            if (writeMode) {
                _80store = false;
                _debug('80 Store Off');
                vm.page(_page2 ? 2 : 1);
            } else {
                // Chain to io for keyboard
                result = io.ioSwitch(off, val);
            }
            break;
        case LOC._80STOREON:
            if (writeMode) {
                _80store = true;
                _debug('80 Store On');
            } else
                result = 0;
            break;
        case LOC.RAMRDOFF:
            if (writeMode) {
                _auxRamRead = false;
                _debug('Aux RAM Read Off');
            } else
                result = 0;
            break;
        case LOC.RAMRDON:
            if (writeMode) {
                _auxRamRead = true;
                _debug('Aux RAM Read On');
            } else
                result = 0;
            break;
        case LOC.RAMWROFF:
            if (writeMode) {
                _auxRamWrite = false;
                _debug('Aux RAM Write Off');
            } else
                result = 0;
            break;
        case LOC.RAMWRON:
            if (writeMode) {
                _auxRamWrite = true;
                _debug('Aux RAM Write On');
            } else
                result = 0;
            break;

        case LOC.INTCXROMOFF:
            if (writeMode) {
                _intcxrom = false;
                _intc8rom = false;
                _debug('Int CX ROM Off');
            }
            break;
        case LOC.INTCXROMON:
            if (writeMode) {
                _intcxrom = true;
                _debug('Int CX ROM On');
            }
            break;
        case LOC.ALTZPOFF: // 0x08
            if (writeMode) {
                _altzp = false;
                _debug('Alt ZP Off');
            }
            break;
        case LOC.ALTZPON: // 0x09
            if (writeMode) {
                _altzp = true;
                _debug('Alt ZP On');
            }
            break;
        case LOC.SLOTC3ROMOFF: // 0x0A
            if (writeMode) {
                _slot3rom = false;
                _debug('Slot 3 ROM Off');
            }
            break;
        case LOC.SLOTC3ROMON: // 0x0B
            if (writeMode) {
                _slot3rom = true;
                _debug('Slot 3 ROM On');
            }
            break;

            // Graphics Switches

        case LOC.CLR80VID:
            if (writeMode) {
                _debug('80 Column Mode off');
                vm._80col(false);
            }
            break;
        case LOC.SET80VID:
            if (writeMode) {
                _debug('80 Column Mode on');
                vm._80col(true);
            }
            break;
        case LOC.CLRALTCH:
            if (writeMode) {
                _debug('Alt Char off');
                vm.altchar(false);
            }
            break;
        case LOC.SETALTCH:
            if (writeMode) {
                _debug('Alt Char on');
                vm.altchar(true);
            }
            break;
        case LOC.PAGE1:
            _page2 = false;
            if (!_80store) {
                result = io.ioSwitch(off, val);
            }
            _debug('Page 2 off');
            break;
        case LOC.PAGE2:
            _page2 = true;
            if (!_80store) {
                result = io.ioSwitch(off, val);
            }
            _debug('Page 2 on');
            break;

        case LOC.RESET_HIRES:
            _hires = false;
            result = io.ioSwitch(off, val);
            _debug('Hires off');
            break;

        case LOC.DHIRESON:
            if (_iouDisable) {
                vm.doubleHires(true);
            } else {
                result = io.ioSwitch(off, val); // an3
            }
            break;

        case LOC.DHIRESOFF:
            if (_iouDisable) {
                vm.doubleHires(false);
            } else {
                result = io.ioSwitch(off, val); // an3
            }
            break;

        case LOC.SET_HIRES:
            _hires = true;
            result = io.ioSwitch(off, val);
            _debug('Hires on');
            break;

        case LOC.IOUDISON:
            if (writeMode) {
                _iouDisable = true;
            }
            result = _iouDisable ? 0x00 : 0x80;
            break;

        case LOC.IOUDISOFF:
            if (writeMode) {
                _iouDisable = false;
            }
            result = vm.isDoubleHires() ? 0x80 : 0x00;
            break;

            // Language Card Switches

        case LOC.READBSR2:  // 0xC080
        case LOC._READBSR2: // 0xC084
            _bank1 = false;
            _readbsr = true;
            _writebsr = false;
            _prewrite = false;
            // _debug('Bank 2 Read');
            break;
        case LOC.WRITEBSR2: // 0xC081
        case LOC._WRITEBSR2: // 0xC085
            _bank1 = false;
            _readbsr = false;
            if (readMode) { _writebsr = _prewrite; }
            _prewrite = readMode;
            // _debug('Bank 2 Write');
            break;
        case LOC.OFFBSR2: // 0xC082
        case LOC._OFFBSR2: // 0xC086
            _bank1 = false;
            _readbsr = false;
            _writebsr = false;
            _prewrite = false;
            // _debug('Bank 2 Off');
            break;
        case LOC.READWRBSR2: // 0xC083
        case LOC._READWRBSR2: // 0xC087
            _bank1 = false;
            _readbsr = true;
            if (readMode) { _writebsr = _prewrite; }
            _prewrite = readMode;
            // _debug('Bank 2 Read/Write');
            break;
        case LOC.READBSR1: // 0xC088
        case LOC._READBSR1: // 0xC08c
            _bank1 = true;
            _readbsr = true;
            _writebsr = false;
            _prewrite = false;
            // _debug('Bank 1 Read');
            break;
        case LOC.WRITEBSR1: // 0xC089
        case LOC._WRITEBSR1: // 0xC08D
            _bank1 = true;
            _readbsr = false;
            if (readMode) { _writebsr = _prewrite; }
            _prewrite = readMode;
            // _debug('Bank 1 Write');
            break;
        case LOC.OFFBSR1: // 0xC08A
        case LOC._OFFBSR1: // 0xC08E
            _bank1 = true;
            _readbsr = false;
            _writebsr = false;
            _prewrite = false;
            // _debug('Bank 1 Off');
            break;
        case LOC.READWRBSR1: // 0xC08B
        case LOC._READWRBSR1:  // 0xC08F
            _bank1 = true;
            _readbsr = true;
            if (readMode) { _writebsr = _prewrite; }
            _prewrite = readMode;
            //_debug('Bank 1 Read/Write');
            break;

            // Status registers

        case LOC.BSRBANK2:
            _debug('Bank 2 Read ' + !_bank1);
            result = !_bank1 ? 0x80 : 0x00;
            break;
        case LOC.BSRREADRAM:
            _debug('Bank SW RAM Read ' + _readbsr);
            result = _readbsr ? 0x80 : 0x00;
            break;
        case LOC.RAMRD: // 0xC013
            _debug('Aux RAM Read ' + _auxRamRead);
            result = _auxRamRead ? 0x80 : 0x0;
            break;
        case LOC.RAMWRT: // 0xC014
            _debug('Aux RAM Write ' + _auxRamWrite);
            result = _auxRamWrite ? 0x80 : 0x0;
            break;
        case LOC.INTCXROM: // 0xC015
            // _debug('Int CX ROM ' + _intcxrom);
            result = _intcxrom ? 0x80 : 0x00;
            break;
        case LOC.ALTZP: // 0xC016
            _debug('Alt ZP ' + _altzp);
            result = _altzp ? 0x80 : 0x0;
            break;
        case LOC.SLOTC3ROM: // 0xC017
            _debug('Slot C3 ROM ' + _slot3rom);
            result = _slot3rom ? 0x80 : 0x00;
            break;
        case LOC._80STORE: // 0xC018
            _debug('80 Store ' + _80store);
            result = _80store ? 0x80 : 0x00;
            break;
        case LOC.VERTBLANK: // 0xC019
            // result = cpu.getCycles() % 20 < 5 ? 0x80 : 0x00;
            result = (cpu.getCycles() < _vbEnd) ? 0x80 : 0x00;
            break;
        case LOC.RDTEXT:
            result = vm.isText() ? 0x80 : 0x0;
            break;
        case LOC.RDMIXED:
            result = vm.isMixed() ? 0x80 : 0x0;
            break;
        case LOC.RDPAGE2:
            result = vm.isPage2() ? 0x80 : 0x0;
            break;
        case LOC.RDHIRES:
            result = vm.isHires() ? 0x80 : 0x0;
            break;
        case LOC.RD80VID:
            result = vm.is80Col() ? 0x80 : 0x0;
            break;
        case LOC.RDALTCH:
            result = vm.isAltChar() ? 0x80 : 0x0;
            break;

        default:
            debug('MMU missing register ' + toHex(off));
            break;
        }

        if (result !== undefined)
            return result;

        result = 0;

        _updateBanks();

        return result;
    }

    return {
        start: function mmu_start() {
            lores1.start();
            lores2.start();
            return 0x00;
        },
        end: function mmu_end() {
            return 0xff;
        },
        reset: function() {
            debug('reset');
            _initSwitches();
            _updateBanks();
            vm.reset();
            io.reset();
        },
        read: function mmu_read(page, off) {
            return _readPages[page].read(page, off);
        },
        write: function mmu_write(page, off, val) {
            _writePages[page].write(page, off, val);
        },
        resetVB: function mmu_resetVB() {
            _vbEnd = cpu.getCycles() + 1000;
        },
        getState: function() {
            return {
                bank1: _bank1,
                readbsr: _readbsr,
                writebsr: _writebsr,
                prewrite: _prewrite,

                intcxrom: _intcxrom,
                slot3rom: _slot3rom,
                intc8rom: _intc8rom,

                auxRamRead: _auxRamRead,
                auxRamWrite: _auxRamWrite,
                altzp: _altzp,

                _80store: _80store,
                page2: _page2,
                hires: _hires,

                mem00_01: [mem00_01[0].getState(), mem00_01[1].getState()],
                mem02_03: [mem02_03[0].getState(), mem02_03[1].getState()],
                mem0C_1F: [mem0C_1F[0].getState(), mem0C_1F[1].getState()],
                mem60_BF: [mem60_BF[0].getState(), mem60_BF[1].getState()],
                memD0_DF: [
                    memD0_DF[0].getState(), memD0_DF[1].getState(),
                    memD0_DF[2].getState(), memD0_DF[3].getState()
                ],
                memE0_FF: [memE0_FF[0].getState(), memE0_FF[1].getState()]
            };
        },
        setState: function(state) {
            _readbsr = state.readbsr;
            _writebsr = state.writebsr;
            _bank1 = state.bank1;
            _prewrite = state.prewrite;

            _intcxrom = state.intcxrom;
            _slot3rom = state.slot3rom;
            _intc8rom = state.intc8rom;

            _auxRamRead = state.auxRamRead;
            _auxRamWrite = state.auxRamWrite;
            _altzp = state.altzp;

            _80store = state._80store;
            _page2 = state.page2;
            _hires = state.hires;

            mem00_01[0].setState(state.mem00_01[0]);
            mem00_01[1].setState(state.mem00_01[1]);
            mem02_03[0].setState(state.mem02_03[0]);
            mem02_03[1].setState(state.mem02_03[1]);
            mem0C_1F[0].setState(state.mem0C_1F[0]);
            mem0C_1F[1].setState(state.mem0C_1F[1]);
            mem60_BF[0].setState(state.mem60_BF[0]);
            mem60_BF[1].setState(state.mem60_BF[1]);
            memD0_DF[0].setState(state.memD0_DF[0]);
            memD0_DF[1].setState(state.memD0_DF[1]);
            memD0_DF[2].setState(state.memD0_DF[2]);
            memD0_DF[3].setState(state.memD0_DF[3]);
            memE0_FF[0].setState(state.memE0_FF[0]);
            memE0_FF[1].setState(state.memE0_FF[1]);

            _updateBanks();
        }
    };
}
