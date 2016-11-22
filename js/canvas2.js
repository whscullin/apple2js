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

/*
 * Text Page 1 Drawing
 */

/*globals allocMemPages: false,
          base64_encode: false, base64_decode: false */
/*exported LoresPage, HiresPage, VideoModes*/

var textMode = true;
var mixedMode = true;
var hiresMode = false;
var pageMode = 1;
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
        _buffer = allocMemPages(0x4);

        for (var idx = 0; idx < 0x400; idx++) {
            _buffer[idx] = 0;
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
            return (0x04 * _page);
        },
        end: function() { return (0x04 * _page) + 0x03; },
        read: function(page, off) {
            var addr = (page << 8) | off,
                base = addr - 0x400 * _page;
            return _buffer[base];
        },
        write: function(page, off, val) {
            var addr = (page << 8) | off,
                base = addr - 0x400 * _page;

            if (_buffer[base] === val && !_refreshing)
                return;
            _buffer[base] = val;

            var col = (base % 0x80) % 0x28,
                adj = off - col;

            // 000001cd eabab000 -> 000abcde
            var ab = (adj & 0x18),
                cd = (page & 0x03) << 1,
                e = adj >> 7;

            var row = ab | cd | e, color, idx, jdx, b;

            if ((row < 24) && (col < 40)) {
                if (!textMode && hiresMode && !(mixedMode && row > 19))
                    return;

                var data = pages[_page].data, fore, back;
                off = (col * 14 + row * 560 * 8 * 2) * 4;

                if (textMode || (mixedMode && row > 19)) {
                    if (val & 0x80 || ((val & 0x40) && _blink)) {
                        fore = _greenMode ? _green : _white;
                        back = _black;
                    } else {
                        fore = _black;
                        back = _greenMode ? _green : _white;
                    }
                    for (jdx = 0; jdx < 8; jdx++) {
                        b = charset[val * 8 + jdx];
                        b <<= 1;
                        for (idx = 0; idx < 7; idx++) {
                            color = (b & 0x80) ? fore : back;
                            _drawPixel(data, off, color);
                            b <<= 1;
                            off += 8;
                        }
                        off += 546 * 4 + 560 * 4;
                    }
                } else {
                    if (_greenMode) {
                        fore = _green;
                        back = _black;
                        for (jdx = 0; jdx < 8; jdx++) {
                            b = (jdx < 4) ? (val & 0x0f) : (val >> 4);
                            b |= (b << 4);
                            b |= (b << 8);
                            if ((col & 0x1) !== 0) {
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
                            b = (jdx < 4) ? (val & 0x0f) : (val >> 4);
                            color = _colors[b];
                            for (idx = 0; idx < 7; idx++) {
                                _drawPixel(data, off, color);
                                off += 8;
                            }
                            off += 546 * 4 + 560 * 4;
                        }
                    }
                }
            }
        },
        refresh: function() {
            var addr = 0x400 * _page;
            _refreshing = true;
            for (var idx = 0; idx < 0x400; idx++, addr++) {
                this.write(addr >> 8, addr & 0xff, _buffer[idx]);
            }
            _refreshing = false;
        },
        blink: function() {
            var addr = 0x400 * _page;
            _refreshing = true;
            _blink = !_blink;
            for (var idx = 0; idx < 0x400; idx++, addr++) {
                var b = _buffer[idx];
                if ((b & 0xC0) == 0x40) {
                    this.write(addr >> 8, addr & 0xff, _buffer[idx]);
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
                green: _green,
                buffer: base64_encode(_buffer)
            };
        },
        setState: function(state) {
            _page = state.page;
            _green = state.green;
            _buffer = base64_decode(state.buffer);

            this.refresh();
        }
    };
}

function HiresPage(page)
{
    var _page = page;

    var orangeCol = [0xff, 0x65, 0x00];
    var greenCol = [0x00, 0xff, 0x00];
    var blueCol = [0x09, 0x2a, 0xff];
    var violetCol = [0xc9, 0x39, 0xc7];
    var whiteCol = [0xff, 0xff, 0xff];
    var blackCol = [0x00, 0x00, 0x00];

    var _buffer = [];
    var _refreshing = false;

    var _green = [0x00, 0xff, 0x80];
    var _greenMode = false;

    function _init() {
        _buffer = allocMemPages(0x20);

        for (var idx = 0; idx < 0x2000; idx++)
            _buffer[idx] = 0; // Math.floor(Math.random()*256);
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

    _init();

    return {
        start: function() { return (0x20 * _page); },
        end: function() { return (0x020 * _page) + 0x1f; },
        read: function(page, off) {
            var addr = (page << 8) | off,
                base = addr - 0x2000 * _page;
            return _buffer[base];
        },
        write: function(page, off, val) {
            function dim(c) {
                return [c[0] * 0.75, c[1] * 0.75, c[2] * 0.75];
            }
            var addr = (page << 8) | off,
                base = addr - 0x2000 * _page;
            if (_buffer[base] === val && !_refreshing)
                return;
            _buffer[base] = val;

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

            if ((rowa < 24) && (col < 40)) {
                if (textMode || !hiresMode || (mixedMode && rowa > 19))
                    return;

                var data = pages[_page].data,
                    dy = rowa * 8 + rowb,
                    dx = col * 14 - 2,
                    b0 = col > 0 ? _buffer[base - 1] : 0,
                    b2 = col < 39 ? _buffer[base + 1] : 0;
                val |= (b2 & 0x3) << 7;
                var v0 = b0 & 0x20, v1 = b0 & 0x40, v2 = val & 0x1,
                    odd = (col & 0x1) === 0,
                    color,
                    oddCol = (hbs ? orangeCol : greenCol),
                    evenCol = (hbs ? blueCol : violetCol);

                off = dx * 4 + dy * 560 * 4 * 2;
                for (var idx = 0; idx < 9; idx++, off += 8) {
                    val >>= 1;

                    if (v1) {
                        if (_greenMode) {
                            color = _green;
                        } else if (v0 || v2) {
                            color = whiteCol;
                        } else {
                            color = odd ? oddCol : evenCol;
                        }
                    } else {
                        if (_greenMode) {
                            color = blackCol;
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
        },
        refresh: function() {
            var addr = 0x2000 * _page;
            _refreshing = true;
            for (var idx = 0; idx < 0x2000; idx++, addr++) {
                this.write(addr >> 8, addr & 0xff, _buffer[idx]);
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
                buffer: base64_encode(_buffer)
            };
        },
        setState: function(state) {
            _page = state.page;
            _greenMode = state.green;
            _buffer = base64_decode(state.buffer);

            this.refresh();
        }
    };
}

function VideoModes(gr,hgr,gr2,hgr2) {
    var _grs = [gr, gr2];
    var _hgrs = [hgr, hgr2];

    function _refresh() {
        _grs[0].refresh();
        _grs[1].refresh();
        _hgrs[0].refresh();
        _hgrs[1].refresh();
    }

    return {
        refresh: function() {
            _refresh();
        },
        text: function(on) {
            var old = textMode;
            textMode = on;
            if (old != on) {
                _refresh();
            }
        },
        hires: function(on) {
            var old = hiresMode;
            hiresMode = on;
            if (old != on) {
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
        setContext: function(c) {
            context = c;

            pages[1] = context.createImageData(560, 384);
            pages[2] = context.createImageData(560, 384);
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
                pageMode: pageMode
            };
        },
        setState: function(state) {
            textMode = state.textMode;
            mixedMode = state.mixedMode;
            hiresMode = state.hiresMode;
            pageMode = state.pageMode;

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
