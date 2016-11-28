/* Copyright 2010-2016 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

/*exported LanguageCard */
/*globals debug: false
          RAM: false */

function LanguageCard(io, slot, rom) {
    'use strict';

    var _rom = rom;
    var _bank1 = null;
    var _bank2 = null;
    var _ram = null;

    var _readbsr = false;
    var _writebsr = false;
    var _bsr2 = false;

    var _last = 0x00;

    var _read1 = null;
    var _read2 = null;

    var _write1 = null;
    var _write2 = null;

    function _init() {
        debug('Language card in slot', slot);

        _bank1 = new RAM(0xd0, 0xdf);
        _bank2 = new RAM(0xd0, 0xdf);
        _ram = new RAM(0xe0, 0xff);

        _write1 = _rom;
        _write2 = _rom;

        _read1 = _rom;
        _read2 = _rom;
    }

    function _debug() {
        // debug.apply(arguments);
    }

    _init();

    var LOC = {
        // Status
        BSRBANK2: 0x11,
        BSRREADRAM: 0x12,

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

    function _access(off) {
        var result = 0;
        switch (off) {
        case LOC.READBSR2:
        case LOC._READBSR2:
            _readbsr = true;
            _writebsr = false;
            _bsr2 = true;
            _debug('Bank 2 Read');
            break;
        case LOC.WRITEBSR2:
        case LOC._WRITEBSR2:
            _readbsr = false;
            _writebsr = ((_last & 0xF3) == (off & 0xF3));
            _bsr2 = true;
            _debug('Bank 2 Write');
            break;
        case LOC.OFFBSR2:
        case LOC._OFFBSR2:
            _readbsr = false;
            _writebsr = false;
            _bsr2 = true;
            _debug('Bank 2 Off');
            break;
        case LOC.READWRBSR2:
        case LOC._READWRBSR2:
            _readbsr = true;
            _writebsr = ((_last & 0xF3) == (off & 0xF3));
            _bsr2 = true;
            _debug('Bank 2 Read/Write');
            break;

        case LOC.READBSR1:
        case LOC._READBSR1:
            _readbsr = true;
            _writebsr = false;
            _bsr2 = false;
            _debug('Bank 1 Read');
            break;
        case LOC.WRITEBSR1:
        case LOC._WRITEBSR1:
            _readbsr = false;
            _writebsr = ((_last & 0xF3) == (off & 0xF3));
            _bsr2 = false;
            _debug('Bank 1 Write');
            break;
        case LOC.OFFBSR1:
        case LOC._OFFBSR1:
            _readbsr = false;
            _writebsr = false;
            _bsr2 = false;
            _debug('Bank 1 Off');
            break;
        case LOC.READWRBSR1:
        case LOC._READWRBSR1:
            _readbsr = true;
            _writebsr = ((_last & 0xF3) == (off & 0xF3));
            _bsr2 = false;
            _debug('Bank 1 Read/Write');
            break;

        case LOC.BSRBANK2:
            result = _bsr2 ? 0x80 : 0x00;
            _debug('Bank 2 Read ' + _bsr2);
            break;
        case LOC.BSRREADRAM:
            result = _readbsr ? 0x80 : 0x00;
            _debug('Bank SW RAM Read ' + _readbsr);
            break;
        default:
            break;
        }
        _last = off;

        if (_readbsr) {
            _read1 = _bsr2 ? _bank2 : _bank1;
            _read2 = _ram;
        } else {
            _read1 = _rom;
            _read2 = _rom;
        }

        if (_writebsr) {
            _write1 = _bsr2 ? _bank2 : _bank1;
            _write2 = _ram;
        } else {
            _write1 = rom;
            _write2 = rom;
        }

        return result;
    }

    return {
        start: function() {
            return 0xd0;
        },
        end: function() {
            return 0xff;
        },
        ioSwitch: function(off, val) {
            return _access(off, val);
        },
        read: function(page, off, dbg) {
            var result = 0;
            if (page < 0xe0) {
                result = _read1.read(page, off, dbg);
            } else {
                result = _read2.read(page, off, dbg);
            }
            return result;
        },
        write: function(page, off, val) {
            if (page < 0xe0) {
                _write1.write(page, off, val);
            } else {
                _write2.write(page, off, val);
            }
        },
        getState: function() {
            return {
                readbsr: _readbsr,
                writebsr: _writebsr,
                bsr2: _bsr2,
                last: _last,
                bank1: _bank1.getState(),
                bank2: _bank2.getState()
            };
        },
        setState: function(state) {
            _readbsr = state.readbsr;
            _writebsr = state.writebsr;
            _bsr2 = state.bsr2;
            _bank1.setState(state.bank1);
            _bank2.setState(state.bank2);
            _access(-1);
            _last = state.last;
        }
    };
}
