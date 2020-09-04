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

import { base64_decode, base64_encode } from './base64';
import { allocMemPages } from './util';

var enhanced = false;
var multiScreen = false;
var textMode = true;
var mixedMode = false;
var hiresMode = false;
var pageMode = 1;
var _80colMode = false;
var altCharMode = false;
var an3 = false;
var doubleHiresMode = false;
var monoDHRMode = false;
var colorDHRMode = false;
var mixedDHRMode = false;
var highColorHGRMode = false;
var highColorTextMode = false;
var oneSixtyMode = false;

function dim(c) {
    return [
        c[0] * 0.75 & 0xff,
        c[1] * 0.75 & 0xff,
        c[2] * 0.75 & 0xff
    ];
}

// hires colors
var orangeCol = [255, 106,  60];
var greenCol =  [ 20, 245,  60];
var blueCol =   [ 20, 207, 253];
var violetCol = [255,  68, 253];
var whiteCol =  [255, 255, 255];
var blackCol =  [  0,   0,   0];

/****************************************************************************
 *
 * Text/Lores Graphics
 *
 ***************************************************************************/

export function LoresPage(page, charset, e, context)
{
    // $00-$3F inverse
    // $40-$7F flashing
    // $80-$FF normal

    var _page = page;
    var _imageData;
    var _buffer = [];
    var _refreshing = false;
    var _monoMode = false;
    var _blink = false;
    var _dirty = {
        top: 385,
        bottom: -1,
        left: 561,
        right: -1
    };

    var _colors = [
        [  0,   0,   0], // 0x0 black
        [227,  30,  96], // 0x1 deep red
        [ 96,  78, 189], // 0x2 dark blue
        [255,  68, 253], // 0x3 purple
        [  0, 163,  96], // 0x4 dark green
        [156, 156, 156], // 0x5 dark gray
        [ 20, 207, 253], // 0x6 medium blue
        [208, 195, 255], // 0x7 light blue
        [ 96, 114,   3], // 0x8 brown
        [255, 106,  60], // 0x9 orange
        [156, 156, 156], // 0xa light gray
        [255, 160, 208], // 0xb pink
        [ 20, 245,  60], // 0xc green
        [208, 221, 141], // 0xd yellow
        [114, 255, 208], // 0xe aquamarine
        [255, 255, 255], // 0xf white
    ];

    function _init() {
        var idx;
        _imageData = context.createImageData(560, 384);
        for (idx = 0; idx < 560 * 384 * 4; idx++) {
            _imageData.data[idx] = 0xff;
        }
        _buffer[0] = allocMemPages(0x4);
        _buffer[1] = allocMemPages(0x4);
    }

    function _drawPixel(data, off, color) {
        var c0 = color[0], c1 = color[1], c2 = color[2];
        data[off + 0] = data[off + 4] = c0;
        data[off + 1] = data[off + 5] = c1;
        data[off + 2] = data[off + 6] = c2;
        var nextOff = off + 560 * 4;
        data[nextOff] = data[nextOff + 4] = c0;
        data[nextOff + 1] = data[nextOff + 5] = c1;
        data[nextOff + 2] = data[nextOff + 6] = c2;
    }

    function _drawHalfPixel(data, off, color) {
        var c0 = color[0], c1 = color[1], c2 = color[2];
        data[off + 0] = c0;
        data[off + 1] = c1;
        data[off + 2] = c2;
        var nextOff = off + 560 * 4;
        data[nextOff] = c0;
        data[nextOff + 1] = c1;
        data[nextOff + 2] = c2;
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

        // These are used by both bank 0 and 1

        _start: function() {
            return (0x04 * _page);
        },
        _end: function() { return (0x04 * _page) + 0x03; },
        _read: function(page, off, bank) {
            var addr = (page << 8) | off, base = addr & 0x3FF;
            return _buffer[bank][base];
        },

        _write: function(page, off, val, bank) {
            var addr = (page << 8) | off,
                base = addr & 0x3FF,
                fore, back;

            if (_buffer[bank][base] == val && !_refreshing) {
                return;
            }
            _buffer[bank][base] = val;

            var col = (base % 0x80) % 0x28,
                adj = off - col;

            // 000001cd eabab000 -> 000abcde
            var ab = (adj & 0x18),
                cd = (page & 0x03) << 1,
                ee = adj >> 7;
            var idx, jdx;
            var row = ab | cd | ee;
            var b;

            var data = _imageData.data;
            if ((row < 24) && (col < 40)) {
                var y = row << 4;
                if (y < _dirty.top) { _dirty.top = y; }
                y += 16;
                if (y > _dirty.bottom) { _dirty.bottom = y; }
                var x = col * 14;
                if (x < _dirty.left) { _dirty.left = x; }
                x += 14;
                if (x > _dirty.right) { _dirty.right = x; }

                var color;
                if (textMode || hiresMode || (mixedMode && row > 19)) {
                    var inverse;
                    if (e) {
                        if (!_80colMode && !altCharMode) {
                            inverse = ((val & 0xc0) == 0x40) && _blink;
                        }
                    } else {
                        inverse = !((val & 0x80) || (val & 0x40) && _blink);
                    }

                    fore = inverse ? blackCol : whiteCol;
                    back = inverse ? whiteCol : blackCol;

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
                            fore = _colors[_buffer[1][base] >> 4];
                            back = _colors[_buffer[1][base] & 0x0f];
                        }

                        if (e) {
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
                        } else {
                            var colorMode = mixedMode && !textMode && !_monoMode;
                            // var val0 = col > 0 ? _buffer[0][base - 1] : 0;
                            // var val2 = col < 39 ? _buffer[0][base + 1] : 0;

                            for (jdx = 0; jdx < 8; jdx++) {
                                var odd = !(col & 0x1);
                                b = charset[val * 8 + jdx] << 1;
                                if (colorMode) {
                                    // var b0 = charset[val0 * 8 + jdx];
                                    // var b2 = charset[val2 * 8 + jdx];
                                    if (inverse) { b ^= 0x1ff; }
                                }

                                for (idx = 0; idx < 7; idx++) {
                                    if (colorMode) {
                                        if (b & 0x80) {
                                            if ((b & 0x1c0) != 0x80) {
                                                color = whiteCol;
                                            } else {
                                                color = odd ? violetCol : greenCol;
                                            }
                                        } else {
                                            color = blackCol;
                                        }
                                        odd = !odd;
                                    } else {
                                        color = (b & 0x80) ? fore : back;
                                    }
                                    _drawPixel(data, off, color);
                                    b <<= 1;
                                    off += 8;
                                }
                                off += 546 * 4 + 560 * 4;
                            }
                        }
                    }
                } else {
                    if (!_80colMode && bank == 1) {
                        return;
                    }
                    if (_80colMode && !an3) {
                        off = (col * 14 + (bank ? 0 : 1) * 7 + row * 560 * 8 * 2) * 4;
                        if (_monoMode) {
                            fore = whiteCol;
                            back = blackCol;
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

                        if (_monoMode) {
                            fore = whiteCol;
                            back = blackCol;
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
                                color = _colors[(jdx < 4) ? (val & 0x0f) : (val >> 4)];
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
                if (_80colMode) {
                    this._write(addr >> 8, addr & 0xff, _buffer[1][idx], 1);
                }
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
        mono: function(on) {
            _monoMode = on;
            this.refresh();
        },
        blit: function(mixed) {
            if (_dirty.top === 385) { return false; }
            var top = _dirty.top;
            var bottom = _dirty.bottom;
            var left = _dirty.left;
            var right = _dirty.right;

            if (mixed) {
                if (bottom < 320) { return false; }
                if (top < 320) { top = 320; }
            }
            context.putImageData(
                _imageData, 0, 0, left, top, right - left, bottom - top
            );
            _dirty = {
                top: 385,
                bottom: -1,
                left: 561,
                right: -1
            };
            return true;
        },
        start: function() {
            var self = this;
            setInterval(function() {
                self.blink();
            }, 267);
            return this._start();
        },
        end: function() {
            return this._end();
        },
        read: function(page, off) {
            return this._read(page, off, 0);
        },
        write: function(page, off, val) {
            return this._write(page, off, val, 0);
        },
        getState: function() {
            return {
                page: _page,
                mono: _monoMode,
                buffer: [
                    base64_encode(_buffer[0]),
                    base64_encode(_buffer[1])
                ]
            };
        },
        setState: function(state) {
            _page = state.page;
            _monoMode = state.mono;
            _buffer[0] = base64_decode(state.buffer[0]);
            _buffer[1] = base64_decode(state.buffer[1]);

            this.refresh();
        },

        getText() {
            function rowToBase(row) {
                var ab = (row >> 3) & 3;
                var cd = (row >> 1) & 0x3;
                var e = row & 1;
                return (cd << 8) | (e << 7) | (ab <<  5) | (ab << 3);
            }

            function mapCharCode(charCode) {
                charCode &= 0x7F;
                if (charCode < 0x20) {
                    charCode += 0x40;
                }
                if (!e && (charCode >= 0x60)) {
                    charCode -= 0x40;
                }
                return charCode;
            }

            var buffer = '', line, charCode;
            var row, col, base;
            for (row = 0; row < 24; row++) {
                base = rowToBase(row);
                line = '';
                if (e && _80colMode) {
                    for (col = 0; col < 80; col++) {
                        charCode = mapCharCode(_buffer[1 - col % 2][base + Math.floor(col / 2)]);
                        line += String.fromCharCode(charCode);
                    }
                } else {
                    for (col = 0; col < 40; col++) {
                        charCode = mapCharCode(_buffer[0][base + col]);
                        line += String.fromCharCode(charCode);
                    }
                }
                line = line.trimRight();
                buffer +=  line + '\n';
            }
            return buffer;
        }
    };
}

/****************************************************************************
 *
 * Hires Graphics
 *
 ***************************************************************************/

export function HiresPage(page, context)
{
    var _page = page;
    var _imageData;
    var _dirty = {
        top: 385,
        bottom: -1,
        left: 561,
        right: -1
    };

    var r4 = [
        0,   // Black
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
        15   // White
    ];

    var dcolors = [
        [  0,   0,   0], // 0x0 black
        [227,  30,  96], // 0x1 deep red
        [ 96,  78, 189], // 0x2 dark blue
        [255,  68, 253], // 0x3 purple
        [  0, 163,  96], // 0x4 dark green
        [156, 156, 156], // 0x5 dark gray
        [ 20, 207, 253], // 0x6 medium blue
        [208, 195, 255], // 0x7 light blue
        [ 96, 114,   3], // 0x8 brown
        [255, 106,  60], // 0x9 orange
        [156, 156, 156], // 0xa light gray
        [255, 160, 208], // 0xb pink
        [ 20, 245,  60], // 0xc green
        [208, 221, 141], // 0xd yellow
        [114, 255, 208], // 0xe aquamarine
        [255, 255, 255], // 0xf white
    ];

    var _buffer = [];
    var _refreshing = false;

    var _monoMode = false;

    function _init() {
        var idx;
        _imageData = context.createImageData(560, 384);
        for (idx = 0; idx < 560 * 384 * 4; idx++) {
            _imageData.data[idx] = 0xff;
        }
        _buffer[0] = allocMemPages(0x20);
        _buffer[1] = allocMemPages(0x20);
    }

    function _drawPixel(data, off, color) {
        var c0 = color[0], c1 = color[1], c2 = color[2];

        data[off + 0] = data[off + 4] = c0;
        data[off + 1] = data[off + 5] = c1;
        data[off + 2] = data[off + 6] = c2;
        var nextOff = off + 560 * 4;
        data[nextOff] = data[nextOff + 4] = c0;
        data[nextOff + 1] = data[nextOff + 5] = c1;
        data[nextOff + 2] = data[nextOff + 6] = c2;
    }

    function _drawHalfPixel(data, off, color) {
        var c0 = color[0], c1 = color[1], c2 = color[2];
        data[off + 0] = c0;
        data[off + 1] = c1;
        data[off + 2] = c2;
        var nextOff = off + 560 * 4;
        data[nextOff] = c0;
        data[nextOff + 1] = c1;
        data[nextOff + 2] = c2;
    }

    //
    // 160x192 pixels alternate 3 and 4 base pixels wide
    //

    function _draw3Pixel(data, off, color) {
        var c0 = color[0], c1 = color[1], c2 = color[2];

        data[off + 0] = data[off + 4] = data[off + 8] = c0;
        data[off + 1] = data[off + 5] = data[off + 9] = c1;
        data[off + 2] = data[off + 6] = data[off + 10] = c2;
        var nextOff = off + 560 * 4;
        data[nextOff] = data[nextOff + 4] = data[nextOff + 8] = c0;
        data[nextOff + 1] = data[nextOff + 5] = data[nextOff + 9] = c1;
        data[nextOff + 2] = data[nextOff + 6] = data[nextOff + 10] = c2;
    }

    function _draw4Pixel(data, off, color) {
        var c0 = color[0], c1 = color[1], c2 = color[2];

        data[off + 0] = data[off + 4] = data[off + 8] = data[off + 12] = c0;
        data[off + 1] = data[off + 5] = data[off + 9] = data[off + 13] = c1;
        data[off + 2] = data[off + 6] = data[off + 10] = data[off + 14] = c2;
        var nextOff = off + 560 * 4;
        data[nextOff] = data[nextOff + 4] = data[nextOff + 8] = data[nextOff + 12] = c0;
        data[nextOff + 1] = data[nextOff + 5] = data[nextOff + 9] = data[nextOff + 13] = c1;
        data[nextOff + 2] = data[nextOff + 6] = data[nextOff + 10] = data[nextOff + 14] = c2;
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
            var addr = (page << 8) | off, base = addr & 0x1FFF;
            return _buffer[bank][base];
        },

        _write: function(page, off, val, bank) {
            var addr = (page << 8) | off, base = addr & 0x1FFF,
                idx, jdx;

            if (_buffer[bank][base] == val && !_refreshing) {
                return;
            }
            _buffer[bank][base] = val;

            var hbs = val & 0x80;

            var col = (base % 0x80) % 0x28,
                adj = off - col;

            // 000001cd eabab000 -> 000abcde
            var ab = (adj & 0x18),
                cd = (page & 0x03) << 1,
                e = adj >> 7;

            var rowa = ab | cd | e,
                rowb = base >> 10;

            var dx, dy, data = _imageData.data;
            if ((rowa < 24) && (col < 40)) {
                if (!multiScreen && !hiresMode) {
                    return;
                }

                var y = rowa << 4 | rowb << 1;
                if (y < _dirty.top) { _dirty.top = y; }
                y += 2;
                if (y > _dirty.bottom) { _dirty.bottom = y; }
                var x = col * 14 - 2;
                if (x < _dirty.left) { _dirty.left = x; }
                x += 18;
                if (x > _dirty.right) { _dirty.right = x; }

                dy = rowa << 4 | rowb << 1;
                var bz, b0, b1, b2, b3, b4, c, hb;
                if (oneSixtyMode && !_monoMode) {
                    // 1 byte = two pixels, but 3:4 ratio
                    var c3 = val & 0xf;
                    var c4 = val >> 4;

                    dx = col * 2 + (bank ^ 1);
                    off = dx * 28 + dy * 280 * 4 * 2;

                    _draw3Pixel(data, off, dcolors[c3]);
                    _draw4Pixel(data, off + 12, dcolors[c4]);
                } else if (doubleHiresMode) {
                    val &= 0x7f;

                    // Every 4 bytes is 7 pixels
                    // 2 bytes per bank

                    // b0       b1       b2       b3
                    //  c0  c1    c2  c3    c4  c5    c6
                    // 76543210 76543210 76543210 76543210
                    //  1111222  2333344  4455556  6667777

                    var mod = col % 2, mcol = col - mod, baseOff = base - mod;
                    bz = _buffer[0][baseOff - 1];
                    b0 = _buffer[1][baseOff];
                    b1 = _buffer[0][baseOff];
                    b2 = _buffer[1][baseOff + 1];
                    b3 = _buffer[0][baseOff + 1];
                    b4 = _buffer[1][baseOff + 2];
                    c = [
                        0,
                        ((b0 & 0x0f) >> 0), // 0
                        ((b0 & 0x70) >> 4) | ((b1 & 0x01) << 3), // 1
                        ((b1 & 0x1e) >> 1), // 2
                        ((b1 & 0x60) >> 5) | ((b2 & 0x03) << 2), // 3
                        ((b2 & 0x3c) >> 2), // 4
                        ((b2 & 0x40) >> 6) | ((b3 & 0x07) << 1), // 5
                        ((b3 & 0x78) >> 3), // 6
                        0
                    ], // 7
                    hb = [
                        0,
                        b0 & 0x80, // 0
                        b0 & 0x80, // 1
                        b1 & 0x80, // 2
                        b2 & 0x80, // 3
                        b2 & 0x80, // 4
                        b3 & 0x80, // 5
                        b3 & 0x80, // 6
                        0
                    ]; // 7
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
                    if (_monoMode || monoDHRMode) {
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
                            } else if (
                                ((c[idx] != c[idx - 1]) && (c[idx] != c[idx + 1])) &&
                                (((bits & 0x1c) == 0x1c) ||
                                ((bits & 0x70) == 0x70) ||
                                ((bits & 0x38) == 0x38))
                            ) {
                                _drawHalfPixel(data, off, whiteCol);
                            } else if (
                                (bits & 0x38) ||
                                (c[idx] == c[idx + 1]) ||
                                (c[idx] == c[idx - 1])
                            ) {
                                _drawHalfPixel(data, off, dcolor);
                            }  else if (bits & 0x28) {
                                _drawHalfPixel(data, off, dim(dcolor));
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
                    val = _buffer[0][base];
                    hbs = val & 0x80;
                    val &= 0x7f;
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

                    monoColor = _monoMode ? whiteCol : null;

                    for (idx = 0; idx < 9; idx++, off += 8) {
                        val >>= 1;

                        if (v1) {
                            if (monoColor) {
                                color = monoColor;
                            } else if (highColorHGRMode) {
                                color = dcolors[_buffer[1][base] >> 4];
                            } else if (v0 || v2) {
                                color = whiteCol;
                            } else {
                                color = odd ? oddCol : evenCol;
                            }
                        } else {
                            if (monoColor) {
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
                if (_80colMode) {
                    this._write(page, off, _buffer[1][idx], 1);
                }
            }
            _refreshing = false;
        },
        mono: function(on) {
            _monoMode = on;
            this.refresh();
        },
        blit: function(mixed) {
            if (_dirty.top === 385) { return false; }
            var top = _dirty.top;
            var bottom = _dirty.bottom;
            var left = _dirty.left;
            var right = _dirty.right;

            if (mixed) {
                if (top > 320) { return false; }
                if (bottom > 320) { bottom = 320; }
            }
            context.putImageData(
                _imageData, 0, 0, left, top, right - left, bottom - top
            );
            _dirty = {
                top: 385,
                bottom: -1,
                left: 561,
                right: -1
            };
            return true;
        },
        start: function() {
            return this._start();
        },
        end: function() {
            return this._end();
        },
        read: function(page, off) {
            return this._read(page, off, 0);
        },
        write: function(page, off, val) {
            return this._write(page, off, val, 0);
        },
        getState: function() {
            return {
                page: _page,
                mono: _monoMode,
                buffer: [
                    base64_encode(_buffer[0]),
                    base64_encode(_buffer[1])
                ]
            };
        },
        setState: function(state) {
            _page = state.page;
            _monoMode = state.mono;
            _buffer[0] = base64_decode(state.buffer[0]);
            _buffer[1] = base64_decode(state.buffer[1]);

            this.refresh();
        }
    };
}

export function VideoModes(gr, hgr, gr2, hgr2, e) {
    var _grs = [gr, gr2];
    var _hgrs = [hgr, hgr2];
    var _flag = 0;

    function _refresh() {
        highColorTextMode = !an3 && textMode && !_80colMode;
        highColorHGRMode = !an3 && hiresMode && !_80colMode;
        doubleHiresMode = !an3 && hiresMode && _80colMode;
        oneSixtyMode = _flag == 1 && doubleHiresMode;
        mixedDHRMode = _flag == 2 && doubleHiresMode;
        monoDHRMode = _flag == 3 && doubleHiresMode;

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

            _flag = 0;
            an3 = true;

            _refresh();
        },
        text: function(on) {
            var old = textMode;
            textMode = on;

            if (old != on) {
                _refresh();
            }
        },
        _80col: function(on) {
            if (!e) { return; }

            var old = _80colMode;
            _80colMode = on;

            if (old != on) {
                _refresh();
            }
        },
        altchar: function(on) {
            if (!e) { return; }

            var old = altCharMode;
            altCharMode = on;
            if (old != on) {
                _refresh();
            }
        },
        hires: function(on) {
            var old = hiresMode;
            hiresMode = on;
            if (!on) {
                _flag = 0;
            }

            if (old != on) {
                _refresh();
            }
        },
        an3: function(on) {
            if (!e) { return; }

            var old = an3;
            an3 = on;

            if (on) {
                _flag = ((_flag << 1) | (_80colMode ? 0x0 : 0x1)) & 0x3;
            }

            if (old != on) {
                _refresh();
            }
        },
        doubleHires: function(on) {
            this.an3(!on);
        },
        mixed: function(on) {
            var old = mixedMode;
            mixedMode = on;
            if (old != on) {
                _refresh();
            }
        },
        page: function(pageNo) {
            var old = pageMode;
            pageMode = pageNo;
            if (old != pageNo) {
                _refresh();
            }
        },
        enhanced: function(on) {
            enhanced = on;
        },
        multiScreen: function(on) {
            multiScreen = on;
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
        isDoubleHires: function() {
            return doubleHiresMode;
        },
        is80Col: function() {
            return _80colMode;
        },
        isAltChar: function() {
            return altCharMode;
        },
        blit: function() {
            var blitted = false;
            if (multiScreen) {
                blitted = _grs[0].blit() || blitted;
                blitted = _grs[1].blit() || blitted;
                blitted = _hgrs[0].blit() || blitted;
                blitted = _hgrs[1].blit() || blitted;
            } else {
                if (hiresMode && !textMode) {
                    if (mixedMode) {
                        blitted = _grs[pageMode - 1].blit(true) || blitted;
                        blitted = _hgrs[pageMode - 1].blit(true) || blitted;
                    } else {
                        blitted = _hgrs[pageMode - 1].blit();
                    }
                } else {
                    blitted = _grs[pageMode - 1].blit();
                }
            }
            return blitted;
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
                an3: an3
            };
        },
        setState: function(state) {
            textMode = state.textMode;
            mixedMode = state.mixedMode;
            hiresMode = state.hiresMode;
            pageMode = state.pageMode;
            _80colMode = state._80colMode;
            altCharMode = state.altCharMode;
            an3 = state.an3;

            _grs[0].setState(state.grs[0]);
            _grs[1].setState(state.grs[1]);
            _hgrs[0].setState(state.hgrs[0]);
            _hgrs[1].setState(state.hgrs[1]);
        },
        mono: function(on) {
            _grs[0].mono(on);
            _grs[1].mono(on);
            _hgrs[0].mono(on);
            _hgrs[1].mono(on);
        },
        getText() {
            return _grs[pageMode - 1].getText();
        }
    };
}
