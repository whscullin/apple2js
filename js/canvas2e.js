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

/*globals allocMemPages: false, debug: false,
  base64_encode: false, base64_decode: false,
  enhanced: false */
/*exported LoresPage, HiresPage, VideoModes */


var textMode = true;
var mixedMode = false;
var hiresMode = false;
var pageMode = 1;
var _80colMode = false;
var altCharMode = false;
var doubleHiresMode = false;
var monoDHRMode = false;
var colorDHRMode = false;
var mixedDHRMode = false;
var highColorHGRMode = false;
var highColorTextMode = false;

var pages = [];
var context = null;
var scanlines = false;

/****************************************************************************
 *
 * Text/Lores Graphics
 *
 ***************************************************************************/

function LoresPage(page, charset)
{
    'use strict';

    // $00-$3F inverse
    // $40-$7F flashing
    // $80-$FF normal

    var _page = page;
    var _buffer = [];
    var _refreshing = false;
    var _greenMode = false;
    var _blink = false;

    var _black = [0x00,0x00,0x00];
    var _white = [0xff,0xff,0xff];
    var _green = [0x00,0xff,0x80];

    var _colors = [
        [0x00,0x00,0x00],  // black
        [0xdd,0x00,0x33],  // 0x1 deep red
        [0x00,0x00,0x99],  // 0x2 dark blue
        [0xdd,0x00,0xdd],  // 0x3 purple
        [0x00,0x77,0x00],  // 0x4 dark green
        [0x55,0x55,0x55],  // 0x5 dark gray
        [0x23,0x22,0xff],  // 0x6 medium blue
        [0x66,0xaa,0xff],  // 0x7 light blue
        [0x88,0x55,0x22],  // 0x8 brown
        [0xff,0x66,0x00],  // 0x9 orange
        [0xaa,0xaa,0xaa],  // 0xa light gray
        [0xff,0x99,0x88],  // 0xb pink
        [0x00,0xdd,0x00],  // 0xc green
        [0xff,0xff,0x00],  // 0xd yellow
        [0x00,0xff,0x99],  // 0xe aquamarine
        [0xff,0xff,0xff]   // 0xf white
    ];

    function _init() {
        _buffer[0] = allocMemPages(0x4);
        _buffer[1] = allocMemPages(0x4);

        for (var idx = 0; idx < 0x400; idx++) {
            _buffer[0][idx] = 0; // idx & 0x2 ? 0xff : 0x00;
            _buffer[1][idx] = 0; // idx & 0x2 ? 0xff : 0x00;
        }
    }

    function _drawPixel(data, off, color) {
        var c0 = color[0], c1 = color[1], c2 = color[2];
        data[off + 0] = data[off + 4] = c0;
        data[off + 1] = data[off + 5] = c1;
        data[off + 2] = data[off + 6] = c2;
        if (!scanlines) {
            data[off + 560 * 4] = data[off + 560 * 4 + 4] = c0;
            data[off + 560 * 4 + 1] = data[off + 560 * 4 + 5] = c1;
            data[off + 560 * 4 + 2] = data[off + 560 * 4 + 6] = c2;
        } else {
            data[off + 560 * 4] = data[off + 560 * 4 + 4] = c0 >> 1;
            data[off + 560 * 4 + 1] = data[off + 560 * 4 + 5] = c1 >> 1;
            data[off + 560 * 4 + 2] = data[off + 560 * 4 + 6] = c2 >> 1;
        }
    }

    function _drawHalfPixel(data, off, color) {
        var c0 = color[0], c1 = color[1], c2 = color[2];
        data[off + 0] = c0;
        data[off + 1] = c1;
        data[off + 2] = c2;
        if (!scanlines) {
            data[off + 560 * 4] = c0;
            data[off + 560 * 4 + 1] = c1;
            data[off + 560 * 4 + 2] = c2;
        } else {
            data[off + 560 * 4] = c0 >> 1;
            data[off + 560 * 4 + 1] = c1 >> 1;
            data[off + 560 * 4 + 2] = c2 >> 1;
        }
    }

    _init();

    return {
        start: function() {
            var self = this;
            window.setInterval(function() {
                self.blink();
            }, 267);
        },
        bank0: function() {
            var self = this;
            return {
                start: function() {
                    return self._start();
                },
                end: function() {
                    return self._end();
                },
                read: function(page, off) {
                    return self._read(page, off, 0);
                },
                write: function(page, off, val) {
                    return self._write(page, off, val, 0);
                }
            };
        },

        bank1: function() {
            var self = this;
            return {
                start: function() {
                    return self._start();
                },
                end: function() {
                    return self._end();
                },
                read: function(page, off) {
                    return self._read(page, off, 1);
                },
                write: function(page, off, val) {
                    return self._write(page, off, val, 1);
                }
            };
        },

        // These are used by both bank 0 and 1

        _start: function() {
            return (0x04 * _page);
        },
        _end: function() { return (0x04 * _page) + 0x03; },
        _read: function(page, off, bank) {
            var addr = (page << 8) | off,
                base = addr - 0x400 * _page;
            return _buffer[bank][base];
        },
        _write: function(page, off, val, bank) {
            var addr = (page << 8) | off,
                base = addr - 0x400 * _page,
                fore, back;

            if (_buffer[bank][base] == val && !_refreshing)
                return;
            _buffer[bank][base] = val;

            var col = (base % 0x80) % 0x28,
                adj = off - col;

            // 000001cd eabab000 -> 000abcde
            var ab = (adj & 0x18),
                cd = (page & 0x03) << 1,
                e = adj >> 7;
            var idx, jdx;
            var row = ab | cd | e;
            var b;

            var data = pages[_page].data;
            if ((row < 24) && (col < 40)) {
                if (!textMode && hiresMode && !(mixedMode && row > 19))
                    return;

                var color;
                if (textMode || (mixedMode && row > 19)) {
                    var flash = ((val & 0xc0) == 0x40) &&
                        _blink && !_80colMode && !altCharMode;
                    fore = flash ? _black : (_greenMode ? _green : _white);
                    back = flash ? (_greenMode ? _green : _white) : _black;

                    if (_80colMode) {
                        if (!enhanced) {
                            val = (val >= 0x40 && val < 0x60) ? val - 0x40 : val;
                        } else if (!altCharMode) {
                            val = (val >= 0x40 && val < 0x80) ? val - 0x40 : val;
                        }

                        off = (col * 14 + (bank ? 0 : 1) * 7 + row * 560 * 8 * 2) * 4;

                        for (jdx = 0; jdx < 8; jdx++) {
                            b = charset[val * 8 + jdx];
                            for (idx = 0; idx < 7; idx++) {
                                color = (b & 0x01) ? back : fore;
                                _drawHalfPixel(data, off, color);
                                b >>= 1;
                                off += 4;
                            }
                            off += 553 * 4 + 560 * 4;
                        }
                    } else {
                        val = _buffer[0][base];

                        if (!enhanced) {
                            val = (val >= 0x40 && val < 0x60) ? val - 0x40 : val;
                        } else if (!altCharMode) {
                            val = (val >= 0x40 && val < 0x80) ? val - 0x40 : val;
                        }

                        off = (col * 14 + row * 560 * 8 * 2) * 4;

                        if (highColorTextMode) {
                            fore = _colors[_buffer[0][base] >> 4];
                            back = _colors[_buffer[0][base] & 0x0f];
                        }

                        for (jdx = 0; jdx < 8; jdx++) {
                            b = charset[val * 8 + jdx];
                            for (idx = 0; idx < 7; idx++) {
                                color = (b & 0x01) ? back : fore;
                                _drawPixel(data, off, color);
                                b >>= 1;
                                off += 8;
                            }
                            off += 546 * 4 + 560 * 4;
                        }
                    }
                } else {
                    if (_80colMode) {
                        off = (col * 14 + (bank ? 0 : 1) * 7 + row * 560 * 8 * 2) * 4;
                        if (_greenMode) {
                            fore = _green;
                            back = _black;
                            for (jdx = 0; jdx < 8; jdx++) {
                                b = (jdx < 8) ? (val & 0x0f) : (val >> 4);
                                b |= (b << 4);
                                if (bank & 0x1) {
                                    b <<= 1;
                                }
                                for (idx = 0; idx < 7; idx++) {
                                    color = (b & 0x80) ? fore : back;
                                    _drawHalfPixel(data, off, color);
                                    b <<= 1;
                                    off += 4;
                                }
                                off += 553 * 4 + 560 * 4;
                            }
                        } else {
                            if (bank & 0x1) {
                                val = ((val & 0x77) << 1) | ((val & 0x88) >> 3);
                            }
                            for (jdx = 0; jdx < 8; jdx++) {
                                color = _colors[(jdx < 4) ?
                                                (val & 0x0f) : (val >> 4)];
                                for (idx = 0; idx < 7; idx++) {
                                    _drawHalfPixel(data, off, color);
                                    off += 4;
                                }
                                off += 553 * 4 + 560 * 4;
                            }
                        }
                    } else {
                        off = (col * 14 + row * 560 * 8 * 2) * 4;

                        if (_greenMode) {
                            fore = _green;
                            back = _black;
                            for (jdx = 0; jdx < 8; jdx++) {
                                b = (jdx < 4) ? (val & 0x0f) : (val >> 4);
                                b |= (b << 4);
                                b |= (b << 8);
                                if (col & 0x1) {
                                    b <<= 2;
                                }
                                for (idx = 0; idx < 14; idx++) {
                                    color = (b & 0x8000) ? fore : back;
                                    _drawHalfPixel(data, off, color);
                                    b <<= 1;
                                    off += 4;
                                }
                                off += 546 * 4 + 560 * 4;
                            }
                        } else {
                            for (jdx = 0; jdx < 8; jdx++) {
                                color = _colors[(jdx < 4) ?
                                                (val & 0x0f) : (val >> 4)];
                                for (idx = 0; idx < 7; idx++) {
                                    _drawPixel(data, off, color);
                                    off += 8;
                                }
                                off += 546 * 4 + 560 * 4;
                            }
                        }
                    }
                }
            }
        },
        refresh: function() {
            var addr = 0x400 * _page;
            _refreshing = true;
            for (var idx = 0; idx < 0x400; idx++, addr++) {
                this._write(addr >> 8, addr & 0xff, _buffer[0][idx], 0);
                if (_80colMode)
                    this._write(addr >> 8, addr & 0xff, _buffer[1][idx], 1);
            }
            _refreshing = false;
        },
        blink: function() {
            var addr = 0x400 * _page;
            _refreshing = true;
            _blink = !_blink;
            for (var idx = 0; idx < 0x400; idx++, addr++) {
                var b = _buffer[0][idx];
                if ((b & 0xC0) == 0x40) {
                    this._write(addr >> 8, addr & 0xff, _buffer[0][idx], 0);
                }
            }
            _refreshing = false;
        },
        green: function(on) {
            _greenMode = on;
            this.refresh();
        },
        blit: function() {
            context.putImageData(pages[_page], 0, 0);
        },
        getState: function() {
            return {
                page: _page,
                green: _greenMode,
                buffer: [base64_encode(_buffer[0]),
                         base64_encode(_buffer[1])]
            };
        },
        setState: function(state) {
            _page = state.page;
            _greenMode = state.green;
            _buffer[0] = base64_decode(state.buffer[0]);
            _buffer[1] = base64_decode(state.buffer[1]);

            this.refresh();
        }
    };
}

/****************************************************************************
 *
 * Hires Graphics
 *
 ***************************************************************************/

function HiresPage(page)
{
    'use strict';

    var _page = page;

    var r4 = [0,   // Black
              2,   // Dark Blue
              4,   // Dark Green
              6,   // Medium Blue

              8,   // Brown
              5,   // Gray 1
              12,  // Light Green
              14,  // Aqua

              1,   // Red
              3,   // Purple
              10,  // Gray 2
              7,  // Pink

              9,   // Orange
              11,   // Light Blue
              13,  // Yellow
              15]; // White

    var dcolors = [
        [0x00,0x00,0x00],  // black
        [0xdd,0x00,0x33],  // 0x1 deep red
        [0x00,0x00,0x99],  // 0x2 dark blue
        [0xdd,0x00,0xdd],  // 0x3 purple
        [0x00,0x77,0x00],  // 0x4 dark green
        [0x55,0x55,0x55],  // 0x5 dark gray
        [0x23,0x22,0xff],  // 0x6 medium blue
        [0x66,0xaa,0xff],  // 0x7 light blue
        [0x88,0x55,0x22],  // 0x8 brown
        [0xff,0x66,0x00],  // 0x9 orange
        [0xaa,0xaa,0xaa],  // 0xa light gray
        [0xff,0x99,0x88],  // 0xb pink
        [0x00,0xdd,0x00],  // 0xc green
        [0xff,0xff,0x00],  // 0xd yellow
        [0x00,0xff,0x99],  // 0xe aquamarine
        [0xff,0xff,0xff]   // 0xf white
    ];

    // hires colors
    var orangeCol = [0xff, 0x65, 0x00];
    var greenCol = [0x00, 0xff, 0x00];
    var blueCol = [0x09, 0x2a, 0xff];
    var violetCol = [0xc9, 0x39, 0xc7];
    var whiteCol = [0xff, 0xff, 0xff];
    var blackCol = [0x00, 0x00, 0x00];

    var _buffer = [];
    var _refreshing = false;

    var _greenMode = false;
    var _green = [0x00, 0xff, 0x80];

    function _init() {
        _buffer[0] = allocMemPages(0x20);
        _buffer[1] = allocMemPages(0x20);
        for (var idx = 0; idx < 0x2000; idx++) {
            _buffer[0][idx] = 0; // idx & 0x2 ? 0xff : 0x00;
            _buffer[1][idx] = 0; // idx & 0x2 ? 0xff : 0x00;
        }
    }

    function _drawPixel(data, off, color) {
        var c0 = color[0], c1 = color[1], c2 = color[2];

        data[off + 0] = data[off + 4] = c0;
        data[off + 1] = data[off + 5] = c1;
        data[off + 2] = data[off + 6] = c2;
        if (!scanlines) {
            data[off + 560 * 4] = data[off + 560 * 4 + 4] = c0;
            data[off + 560 * 4 + 1] = data[off + 560 * 4 + 5] = c1;
            data[off + 560 * 4 + 2] = data[off + 560 * 4 + 6] = c2;
        } else {
            data[off + 560 * 4] = data[off + 560 * 4 + 4] = c0 >> 1;
            data[off + 560 * 4 + 1] = data[off + 560 * 4 + 5] = c1 >> 1;
            data[off + 560 * 4 + 2] = data[off + 560 * 4 + 6] = c2 >> 1;
        }
    }

    function _drawHalfPixel(data, off, color) {
        var c0 = color[0], c1 = color[1], c2 = color[2];
        data[off + 0] = c0;
        data[off + 1] = c1;
        data[off + 2] = c2;
        if (!scanlines) {
            data[off + 560 * 4] = c0;
            data[off + 560 * 4 + 1] = c1;
            data[off + 560 * 4 + 2] = c2;
        } else {
            data[off + 560 * 4] = c0 >> 1;
            data[off + 560 * 4 + 1] = c1 >> 1;
            data[off + 560 * 4 + 2] = c2 >> 1;
        }
    }

    _init();

    return {
        bank0: function() {
            var self = this;
            return {
                start: function() {
                    return self._start();
                },
                end: function() {
                    return self._end();
                },
                read: function(page, off) {
                    return self._read(page, off, 0);
                },
                write: function(page, off, val) {
                    return self._write(page, off, val, 0);
                }
            };
        },

        bank1: function() {
            var self = this;
            return {
                start: function() {
                    return self._start();
                },
                end: function() {
                    return self._end();
                },
                read: function(page, off) {
                    return self._read(page, off, 1);
                },
                write: function(page, off, val) {
                    return self._write(page, off, val, 1);
                }
            };
        },

        _start: function() { return (0x20 * _page); },
        _end: function() { return (0x020 * _page) + 0x1f; },
        _read: function(page, off, bank) {
            var addr = (page << 8) | off, base = addr - 0x2000 * _page;
            return _buffer[bank][base];
        },
        _write: function(page, off, val, bank) {
            function dim(c) {
                return [c[0] * 0.75, c[1] * 0.75, c[2] * 0.75];
            }
            var addr = (page << 8) | off, base = addr - 0x2000 * _page,
                idx, jdx;
            if (_buffer[bank][base] == val && !_refreshing)
                return;
            _buffer[bank][base] = val;

            var hbs = val & 0x80;
            val &= 0x7f;

            var col = (base % 0x80) % 0x28,
                adj = off - col;

            // 000001cd eabab000 -> 000abcde
            var ab = (adj & 0x18),
                cd = (page & 0x03) << 1,
                e = adj >> 7;

            var rowa = ab | cd | e,
                rowb = base >> 10;

            var dx, dy, data = pages[_page].data;
            if ((rowa < 24) && (col < 40)) {
                if (textMode || !hiresMode || (mixedMode && rowa > 19))
                    return;

                dy = rowa * 16 + rowb * 2;
                var bz, b0, b1, b2, b3, b4, c, hb;
                if (doubleHiresMode) {
                    // Every 4 bytes is 7 pixels
                    // 2 bytes per bank
                    var mod = col % 2, mcol = col - mod;
                    bz = _buffer[0][base - mod - 1];
                    b0 = _buffer[1][base - mod];
                    b1 = _buffer[0][base - mod];
                    b2 = _buffer[1][base - mod + 1];
                    b3 = _buffer[0][base - mod + 1];
                    b4 = _buffer[1][base - mod + 2];
                    c = [0,
                         ((b0 & 0x0f) >> 0), // 0
                         ((b0 & 0x70) >> 4) | ((b1 & 0x01) << 3), // 1
                         ((b1 & 0x1e) >> 1), // 2
                         ((b1 & 0x60) >> 5) | ((b2 & 0x03) << 2), // 3
                         ((b2 & 0x3c) >> 2), // 4
                         ((b2 & 0x40) >> 6) | ((b3 & 0x07) << 1), // 5
                         ((b3 & 0x78) >> 3), // 6
                         0], // 7
                    hb = [0,
                          b0 & 0x80, // 0
                          b0 & 0x80, // 1
                          b1 & 0x80, // 2
                          b2 & 0x80, // 3
                          b2 & 0x80, // 4
                          b3 & 0x80, // 5
                          b3 & 0x80, // 6
                         0]; // 7
                    if (col > 0) {
                        c[0] = (bz & 0x78) >> 3;
                        hb[0] = bz & 0x80;
                    }
                    if (col < 39) {
                        c[8] = b4 & 0x0f;
                        hb[8] = b4 & 0x80;
                    }
                    dx = mcol * 14;
                    off = dx * 4 + dy * 280 * 4 * 2;

                    var monoColor = null;
                    if (_greenMode) {
                        monoColor = _green;
                    } else if (monoDHRMode) {
                        monoColor = whiteCol;
                    }

                    for (idx = 1; idx < 8; idx++) {
                        hbs = hb[idx];
                        var dcolor = dcolors[r4[c[idx]]];
                        var bits = c[idx-1] | (c[idx] << 4) | (c[idx+1] << 8);
                        for (jdx = 0; jdx < 4; jdx++, off += 4) {
                            if (monoColor) {
                                if (bits & 0x10) {
                                    _drawHalfPixel(data, off, monoColor);
                                } else {
                                    _drawHalfPixel(data, off, blackCol);
                                }
                            } else if (mixedDHRMode) {
                                if (hbs) {
                                    _drawHalfPixel(data, off, dcolor);
                                } else {
                                    if (bits & 0x10) {
                                        _drawHalfPixel(data, off, whiteCol);
                                    } else {
                                        _drawHalfPixel(data, off, blackCol);
                                    }
                                }
                            } else if (colorDHRMode) {
                                _drawHalfPixel(data, off, dcolor);
                            } else if (((bits & 0x3c) == 0x3c) ||
                                       ((bits & 0xf0) == 0xf0) ||
                                       ((bits & 0x1e) == 0x1e) ||
                                       ((bits & 0x78) == 0x78)) {
                                _drawHalfPixel(data, off, whiteCol);
                            } else if (((c[idx] == c[idx + 1]) &&
                                        (bits & 0xf0)) ||
                                       ((c[idx] == c[idx - 1]) &&
                                        (bits & 0x01e)) ||
                                       (bits & 0x10)) {
                                _drawHalfPixel(data, off, dcolor);
                            } else if ((bits & 0x28) == 0x28) {
                                _drawHalfPixel(data, off, dcolor);
                            } else {
                                _drawHalfPixel(data, off, blackCol);
                            }
                            bits >>= 1;
                        }
                    }

                    if (!_refreshing) {
                        _refreshing = true;
                        var bb = bank ? 0 : 1;
                        for (var rr = addr - 1; rr <= addr + 1; rr++) {
                            var vv = _buffer[bb][rr - 0x2000 * _page];
                            this._write(rr >> 8, rr & 0xff, vv, bb);
                        }
                        _refreshing = false;
                    }
                } else {
                    val = _buffer[0][base] & 0x7f;
                    dx = col * 14 - 2;
                    b0 = col > 0 ? _buffer[0][base - 1] : 0;
                    b2 = col < 39 ? _buffer[0][base + 1] : 0;
                    val |= (b2 & 0x3) << 7;
                    var v0 = b0 & 0x20, v1 = b0 & 0x40, v2 = val & 0x1,
                        odd = !(col & 0x1),
                        color,
                        oddCol = (hbs ? orangeCol : greenCol),
                        evenCol = (hbs ? blueCol : violetCol);

                    off = dx * 4 + dy * 280 * 4 * 2;
                    for (idx = 0; idx < 9; idx++, off += 8) {
                        val >>= 1;
                        if (v1) {
                            if (_greenMode) {
                                color = _green;
                            } else if (highColorHGRMode) {
                                color = dcolors[_buffer[1][base] >> 4];
                            } else if (v0 || v2) {
                                color = whiteCol;
                            } else {
                                color = odd ? oddCol : evenCol;
                            }
                        } else {
                            if (_greenMode) {
                                color = blackCol;
                            } else if (highColorHGRMode) {
                                color = dcolors[_buffer[1][base] & 0x0f];
                            } else if (odd && v2 && v0) {
                                color = v0 ? dim(evenCol) : evenCol;
                            } else if (!odd && v0 && v2) {
                                color = v2 ? dim(oddCol) : oddCol;
                            } else {
                                color = blackCol;
                            }
                        }

                        if (dx > -1 && dx < 560) {
                            _drawPixel(data, off, color);
                        }
                        dx += 2;

                        v0 = v1;
                        v1 = v2;
                        v2 = val & 0x01;
                        odd = !odd;
                    }
                }
            }
        },
        refresh: function() {
            var page, off, idx, addr = 0x2000 * _page;
            _refreshing = true;
            for (idx = 0; idx < 0x2000; idx++, addr++) {
                page = addr >> 8;
                off = addr & 0xff;
                this._write(page, off, _buffer[0][idx], 0);
                if (_80colMode)
                    this._write(page, off, _buffer[1][idx], 1);
            }
            _refreshing = false;
        },
        green: function(on) {
            _greenMode = on;
            this.refresh();
        },
        blit: function() {
            context.putImageData(pages[_page], 0, 0);
        },
        getState: function() {
            return {
                page: _page,
                green: _greenMode,
                buffer: [base64_encode(_buffer[0]),
                         base64_encode(_buffer[1])]
            };
        },
        setState: function(state) {
            _page = state.page;
            _greenMode = state.green;
            _buffer[0] = base64_decode(state.buffer[0]);
            _buffer[1] = base64_decode(state.buffer[1]);

            this.refresh();
        }
    };
}

function VideoModes(gr,hgr,gr2,hgr2) {
    var _grs = [gr, gr2];
    var _hgrs = [hgr, hgr2];
    var _seq = '';

    function _refresh() {
        gr.refresh();
        gr2.refresh();
        hgr.refresh();
        hgr2.refresh();
    }

    return {
        refresh: function() {
            _refresh();
        },
        reset: function() {
            textMode = true;
            mixedMode = false;
            hiresMode = true;
            pageMode = 1;

            _80colMode = false;
            altCharMode = false;

            doubleHiresMode = false;
            monoDHRMode = false;
            colorDHRMode = false;
            mixedDHRMode = false;
            highColorHGRMode = false;
            highColorTextMode = false;

            _refresh();
        },
        text: function(on) {
            var old = textMode;
            textMode = on;

            highColorTextMode = false;

            _seq = on ? 'T+' : 'T-';
            // debug('_seq=', _seq);

            if (old != on) {
                _refresh();
            }
        },
        _80col: function(on) {
            var old = _80colMode;
            _80colMode = on;

            _seq += on ? '8+' : '8-';
            _seq = _seq.substr(0, 16);
            // debug('_seq=', _seq);

            if (old != on) {
                _refresh();
            }
        },
        altchar: function(on) {
            var old = altCharMode;
            altCharMode = on;
            if (old != on) {
                _refresh();
            }
        },
        hires: function(on) {
            var old = hiresMode;
            hiresMode = on;
            highColorHGRMode = false;

            _seq = (on ? 'H+' : 'H-');
            // debug('_seq=', _seq);

            if (old != on) {
                _refresh();
            }
        },
        doublehires: function(on) {
            var old = doubleHiresMode;
            doubleHiresMode = on;

            _seq += on ? 'D+' : 'D-';
            _seq = _seq.substr(0, 16);
            // debug('_seq=', _seq);

            if (on) {
                if (_seq == 'T+D+') {
                    debug('High color text mode');
                    highColorTextMode = true;
                    doubleHiresMode = false;
                } else if (_seq == 'H+8-D+') {
                    debug('High color hgr');
                    highColorHGRMode = true;
                    doubleHiresMode = false;
                } else if (_seq == 'H+8+D+D-D+D-D+') {
                    debug('DoubleHires color');
                    colorDHRMode = true;
                    monoDHRMode = false;
                    mixedDHRMode = false;
                    _seq = '';
                } else if (_seq == 'H+8-D+D-D+D-8+D+') {
                    debug('DoubleHires mono');
                    colorDHRMode = false;
                    monoDHRMode = true;
                    mixedDHRMode = false;
                    _seq = '';
                } else if (_seq == 'H+8-D+D-8+D+D-D+') {
                    debug('DoubleHires mixed');
                    colorDHRMode = false;
                    monoDHRMode = false;
                    mixedDHRMode = true;
                    _seq = '';
                }
            }

            if (old != on) {
                if (on) {
                    this.page(1);
                }
                _refresh();
            }
        },
        mixed: function(on) {
            var old = mixedMode;
            mixedMode = on;
            if (old != on) {
                _refresh();
            }
        },
        page: function(pageNo) {
            pageMode = pageNo;
        },
        isText: function() {
            return textMode;
        },
        isMixed: function() {
            return mixedMode;
        },
        isPage2: function() {
            return pageMode == 2;
        },
        isHires: function() {
            return hiresMode;
        },
        is80Col: function() {
            return _80colMode;
        },
        isAltChar: function() {
            return altCharMode;
        },
        setContext: function(c) {
            context = c;

            pages[1] = c.createImageData(560, 384);
            pages[2] = c.createImageData(560, 384);
            for (var idx = 0; idx < 560 * 384 * 4; idx++) {
                pages[1].data[idx] = 0xff;
                pages[2].data[idx] = 0xff;
            }
        },
        blit: function() {
            if (hiresMode && !textMode) {
                _hgrs[pageMode - 1].blit();
            } else {
                _grs[pageMode - 1].blit();
            }
        },
        getState: function() {
            return {
                grs: [_grs[0].getState(), _grs[1].getState()],
                hgrs: [_hgrs[0].getState(), _hgrs[1].getState()],
                textMode: textMode,
                mixedMode: mixedMode,
                hiresMode: hiresMode,
                pageMode: pageMode,
                _80colMode: _80colMode,
                altCharMode: altCharMode,
                doubleHiresMode: doubleHiresMode
            };
        },
        setState: function(state) {
            textMode = state.textMode;
            mixedMode = state.mixedMode;
            hiresMode = state.hiresMode;
            pageMode = state.pageMode;
            _80colMode = state._80colMode;
            altCharMode = state.altCharMode;
            doubleHiresMode = state.doubleHiresMode;

            _grs[0].setState(state.grs[0]);
            _grs[1].setState(state.grs[1]);
            _hgrs[0].setState(state.hgrs[0]);
            _hgrs[1].setState(state.hgrs[1]);
        },
        green: function(on) {
            _grs[0].green(on);
            _grs[1].green(on);
            _hgrs[0].green(on);
            _hgrs[1].green(on);
        }
    };
}
