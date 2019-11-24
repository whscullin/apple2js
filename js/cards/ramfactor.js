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

import { base64_decode, base64_encode } from '../base64';
import { allocMem, debug } from '../util';
import { rom } from '../roms/cards/ramfactor';

export default function RAMFactor(io, slot, size) {
    var mem = [];

    var _firmware = 0;
    var _ramlo = 0;
    var _rammid = 0;
    var _ramhi = 0;

    var _loc = 0;

    var LOC = {
        // Disk II Stuff
        RAMLO: 0x80,
        RAMMID: 0x81,
        RAMHI: 0x82,
        RAMDATA: 0x83,
        _RAMLO: 0x84,
        _RAMMID: 0x85,
        _RAMHI: 0x86,
        _RAMDATA: 0x87,
        BANK: 0x8F
    };

    function _init() {
        debug('RAMFactor card in slot', slot);

        mem = allocMem(size);
        for (var off = 0; off < size; off++) {
            mem[off] = 0;
        }
    }

    function _sethi(val) {
        _ramhi = (val & 0xff);
    }

    function _setmid(val) {
        if (((_rammid & 0x80) !== 0) && ((val & 0x80) === 0)) {
            _sethi(_ramhi + 1);
        }
        _rammid = (val & 0xff);
    }

    function _setlo(val) {
        if (((_ramlo & 0x80) !== 0) && ((val & 0x80) === 0)) {
            _setmid(_rammid + 1);
        }
        _ramlo = (val & 0xff);
    }

    function _access(off, val) {
        var result = 0;
        switch (off & 0x8f) {
        case LOC.RAMLO:
        case LOC._RAMLO:
            if (val !== undefined) {
                _setlo(val);
            } else {
                result = _ramlo;
            }
            break;
        case LOC.RAMMID:
        case LOC._RAMMID:
            if (val !== undefined) {
                _setmid(val);
            } else {
                result = _rammid;
            }
            break;
        case LOC.RAMHI:
        case LOC._RAMHI:
            if (val !== undefined) {
                _sethi(val);
            } else {
                result = _ramhi;
                result |= 0xf0;
            }
            break;
        case LOC.RAMDATA:
        case LOC._RAMDATA:
            if (val !== undefined) {
                mem[_loc % mem.length] = val;
            } else {
                result = mem[_loc % mem.length];
            }
            _setlo(_ramlo + 1);
            break;
        case LOC.BANK:
            if (val !== undefined) {
                _firmware = val & 0x01;
            } else {
                result = _firmware;
            }
            break;
        default:
            break;
        }
        _loc = (_ramhi << 16) | (_rammid << 8) | (_ramlo);

        /*
        if (val === undefined) {
            debug("Read: " + toHex(result) + " from " + toHex(off) + " (loc = " + _loc + ")");
        } else {
            debug("Wrote: " + toHex(val) + " to " + toHex(off) + " (loc = " + _loc + ")");
        }
        */

        return result;
    }

    _init();

    return {
        ioSwitch: function (off, val) {
            return _access(off, val);
        },
        read: function ramfactor_read(page, off) {
            var result;
            if (page == 0xc0 + slot) {
                result = rom[slot << 8 | off];
            } else {
                result = rom[_firmware << 12 | (page - 0xC0) << 8 | off];
            }
            return result;
        },
        write: function ramfactor_write() {},
        reset: function ramfactor_reset() {
            _firmware = 0;
        },
        getState: function() {
            return {
                loc: _loc,
                firmware: _firmware,
                mem: base64_encode(mem)
            };
        },

        setState: function(state) {
            _loc = state.loc;
            _firmware = state.firmware;
            mem = base64_decode(state.mem);

            _ramhi = (_loc >> 16) & 0xff;
            _rammid = (_loc >> 8) & 0xff;
            _ramlo = (_loc) & 0xff;
        }
    };
}
