/* Copyright 2017 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

import { allocMemPages, debug } from '../util';
import { ROM, VIDEO_ROM } from '../roms/cards/videoterm';

export default function Videoterm(_io) {
    debug('Videx Videoterm');

    var LOC = {
        IOREG: 0x80,
        IOVAL: 0x81
    };


    var REGS = {
        CURSOR_UPPER: 0x0A,
        CURSOR_LOWER: 0x0B,
        STARTPOS_HI: 0x0C,
        STARTPOS_LO: 0x0D,
        CURSOR_HI: 0x0E,
        CURSOR_LO: 0x0F,
        LIGHTPEN_HI: 0x10,
        LIGHTPEN_LO: 0x11
    };

    var CURSOR_MODES = {
        SOLID: 0x00,
        HIDDEN: 0x01,
        BLINK: 0x10,
        FAST_BLINK: 0x11
    };

    var _regs = [
        0x7b, // 00 - Horiz. total
        0x50, // 01 - Horiz. displayed
        0x62, // 02 - Horiz. sync pos
        0x29, // 03 - Horiz. sync width
        0x1b, // 04 - Vert. total
        0x08, // 05 - Vert. adjust
        0x18, // 06 - Vert. displayed
        0x19, // 07 - Vert. sync pos
        0x00, // 08 - Interlaced
        0x08, // 09 - Max. scan line
        0xc0, // 0A - Cursor upper
        0x08, // 0B - Cursor lower
        0x00, // 0C - Startpos Hi
        0x00, // 0D - Startpos Lo
        0x00, // 0E - Cursor Hi
        0x00, // 0F - Cursor Lo
        0x00, // 10 - Lightpen Hi
        0x00  // 11 - Lightpen Lo
    ];

    var _blink = false;
    var _curReg = 0;
    var _startPos;
    var _cursorPos;
    var _shouldRefresh;

    // var _cursor = 0;
    var _bank = 0;
    var _buffer = allocMemPages(8);
    var _imageData;
    var _dirty = false;

    var _black = [0x00, 0x00, 0x00];
    var _white = [0xff, 0xff, 0xff];

    function _init() {
        var idx;

        _imageData = new ImageData(560, 384);
        for (idx = 0; idx < 560 * 384 * 4; idx++) {
            _imageData.data[idx] = 0xff;
        }

        for (idx = 0; idx < 0x800; idx++) {
            _buffer[idx] = idx & 0xff;
        }

        _refresh();

        setInterval(function() {
            _blink = !_blink;
            _refreshCursor();
        }, 300);
    }

    function _updateBuffer(addr, val) {
        _buffer[addr] = val;
        val &= 0x7f; // XXX temp
        var saddr = (0x800 + addr - _startPos) & 0x7ff;
        var data = _imageData.data;
        var row = (saddr / 80) & 0xff;
        var col = saddr % 80;
        var x = col * 7;
        var y = row << 4;
        var c = val << 4;
        var color;

        if (row < 25) {
            _dirty = true;
            for (var idx = 0; idx < 8; idx++) {
                var cdata = VIDEO_ROM[c + idx];
                for (var jdx = 0; jdx < 7; jdx++) {
                    if (cdata & 0x80) {
                        color = _white;
                    } else {
                        color = _black;
                    }
                    data[(y + idx * 2) * 560 * 4 + (x + jdx) * 4] = color[0];
                    data[(y + idx * 2) * 560 * 4 + (x + jdx) * 4 + 1] = color[1];
                    data[(y + idx * 2) * 560 * 4 + (x + jdx) * 4 + 2] = color[2];
                    data[(y + idx * 2 + 1) * 560 * 4 + (x + jdx) * 4] = color[0];
                    data[(y + idx * 2 + 1) * 560 * 4 + (x + jdx) * 4 + 1] = color[1];
                    data[(y + idx * 2 + 1) * 560 * 4 + (x + jdx) * 4 + 2] = color[2];
                    cdata <<= 1;
                }
            }
        }
    }

    function _refreshCursor(fromRegs) {
        var addr = _regs[REGS.CURSOR_HI] << 8 | _regs[REGS.CURSOR_LO];
        var saddr = (0x800 + addr - _startPos) & 0x7ff;
        var data = _imageData.data;
        var row = (saddr / 80) & 0xff;
        var col = saddr % 80;
        var x = col * 7;
        var y = row * 16;
        var blinkmode = (_regs[REGS.CURSOR_UPPER] & 0x60) >> 5;

        if (fromRegs) {
            if (addr !== _cursorPos) {
                var caddr = (0x800 + _cursorPos - _startPos) & 0x7ff;
                _updateBuffer(caddr, _buffer[caddr]);
                _cursorPos = addr;
            }
        }

        _updateBuffer(addr, _buffer[addr]);
        if (blinkmode === CURSOR_MODES.HIDDEN) {
            return;
        }
        if (_blink || (blinkmode === CURSOR_MODES.SOLID)) {
            _dirty = true;
            for (var idx = 0; idx < 8; idx++) {
                var color = _white;
                if (idx >= (_regs[REGS.CURSOR_UPPER] & 0x1f) &&
                    idx <= (_regs[REGS.CURSOR_LOWER] & 0x1f)) {
                    for (var jdx = 0; jdx < 7; jdx++) {
                        data[(y + idx * 2) * 560 * 4 + (x + jdx) * 4] = color[0];
                        data[(y + idx * 2) * 560 * 4 + (x + jdx) * 4 + 1] = color[1];
                        data[(y + idx * 2) * 560 * 4 + (x + jdx) * 4 + 2] = color[2];
                        data[(y + idx * 2 + 1) * 560 * 4 + (x + jdx) * 4] = color[0];
                        data[(y + idx * 2 + 1) * 560 * 4 + (x + jdx) * 4 + 1] = color[1];
                        data[(y + idx * 2 + 1) * 560 * 4 + (x + jdx) * 4 + 2] = color[2];
                    }
                }
            }
        }
    }

    function _updateStartPos() {
        var startPos =
            _regs[REGS.STARTPOS_HI] << 8 |
            _regs[REGS.STARTPOS_LO];
        if (_startPos != startPos) {
            _startPos = startPos;
            _shouldRefresh = true;
        }
    }

    function _refresh() {
        for (var idx = 0; idx < 0x800; idx++) {
            _updateBuffer(idx, _buffer[idx]);
        }
    }

    function _access(off, val) {
        var writeMode = val !== undefined;
        var result = undefined;
        switch (off & 0x81) {
            case LOC.IOREG:
                if (writeMode) {
                    _curReg = val;
                } else {
                    result = _curReg;
                }
                break;
            case LOC.IOVAL:
                if (writeMode) {
                    _regs[_curReg] = val;
                    switch (_curReg) {
                        case REGS.CURSOR_UPPER:
                        case REGS.CURSOR_LOWER:
                            _refreshCursor(true);
                            break;
                        case REGS.CURSOR_HI:
                        case REGS.CURSOR_LO:
                            _refreshCursor(true);
                            break;
                        case REGS.STARTPOS_HI:
                        case REGS.STARTPOS_LO:
                            _updateStartPos();
                            break;
                    }
                } else {
                    result = _regs[_curReg];
                }
                break;
        }
        _bank = (off & 0x0C) >> 2;
        return result;
    }

    _init();

    return {
        ioSwitch: function (off, val) {
            return _access(off, val);
        },

        read: function(page, off) {
            if (page < 0xcc) {
                return ROM[(page & 0x03) << 8 | off];
            } else if (page < 0xce){
                var addr = ((page & 0x01) + (_bank << 1)) << 8 | off;
                return _buffer[addr];
            }
        },

        write: function(page, off, val) {
            if (page > 0xcb && page < 0xce) {
                var addr = ((page & 0x01) + (_bank << 1)) << 8 | off;
                _updateBuffer(addr, val);
            }
        },

        blit: function() {
            if (_shouldRefresh) {
                _refresh();
                _shouldRefresh = false;
            }
            if (_dirty) {
                _dirty = false;
                return _imageData;
            }
            return;
        },

        getState() {
            // TODO: Videoterm State
            return {};
        },
        setState(_) {
        }
    };
}
