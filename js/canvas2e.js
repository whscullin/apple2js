/* -*- mode: JavaScript; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* Copyright 2010-2013 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

/*globals allocMemPages: false, charset: false, base64_encode: false, base64_decode: false */
/*exported LoresPage, HiresPage, VideoModes */

var GREEN = [0x00,0xff,0x00];
// var WHITE = [0xff,0xff,0xff];
var MONO = GREEN;

var textMode = true;
var mixedMode = false;
var hiresMode = false;
var pageMode = 1;
var _80colMode = false;
var altCharMode = false;
var doubleHiresMode = false;
var pages = [];
var context = null;

/****************************************************************************
 *
 * Text/Lores Graphics
 *
 ***************************************************************************/

function LoresPage(page) 
{
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
    var _green = [0x00,0xff,0x00];

    var _colors = [
        [0x00,0x00,0x00], // 0 Black         0000 0   0
        [0x90,0x17,0x40], // 1 Red           0001 8   1
        [0x3c,0x22,0xa5], // 2 Dark Blue     1000 1
        [0xd0,0x43,0xe5], // 3 Purple        1001 9
        [0x00,0x69,0x40], // 4 Dark Green    0100 4
        [0xb0,0xb0,0xb0], // 5 Gray 1        0101 5
        [0x2f,0x95,0xe5], // 6 Medium Blue   1100 12
        [0xbf,0xab,0xff], // 7 Light Blue    1101 13
        [0x40,0x54,0x00], // 8 Brown         0010 2
        [0xd0,0x6a,0x1a], // 9 Orange        0011 3
        [0x40,0x40,0x40], // 10 Gray 2       1010 10
        [0xff,0x96,0xbf], // 11 Pink         1011 11
        [0x2f,0xbc,0x1a], // 12 Light Green  0110 6
        [0xb9,0xd0,0x60], // 13 Yellow       0111 7
        [0x6f,0xe8,0xbf], // 14 Aqua         1110 14
        [0xff,0xff,0xff]  // 15 White        1111 15
    ];

    function _init() {
        _buffer[0] = allocMemPages(0x4);
        _buffer[1] = allocMemPages(0x4);
        
        for (var idx = 0; idx < 0x400; idx++) {
            _buffer[0][idx] = 0; // idx & 0x2 ? 0xff : 0x00;
            _buffer[1][idx] = 0; // idx & 0x2 ? 0xff : 0x00;
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

            if (bank !== 0 && !_80colMode)
                return;

            var col = (base % 0x80) % 0x28,
                adj = off - col;

            // 000001cd eabab000 -> 000abcde 
            var ab = (adj & 0x18),
                cd = (page & 0x03) << 1,
                 e = adj >> 7;
            var idx, jdx;
            var row = ab | cd | e;

            var data = pages[_page].data;
            if ((row < 24) && (col < 40)) {
                if (!textMode && hiresMode && !(mixedMode && row > 19))
                    return;

                var color;
                if (textMode || (mixedMode && row > 19)) {
                    var b;
                    var flash = ((val & 0xc0) == 0x40) && 
                        _blink && !_80colMode; 
                    fore = flash ? _black : (_greenMode ? _green : _white);
                    back = flash ? _white : _black;

                    if (!altCharMode && !_80colMode) {
                        val = (val >= 0x40 && val < 0x80) ? val - 0x40 : val;
                    }

                    if (_80colMode) {
                        off = (col * 14 + (bank ? 0 : 1) * 7 + row * 560 * 8) * 4;
                        for (jdx = 0; jdx < 8; jdx++) {
                            b = charset[val * 8 + jdx];
                            for (idx = 0; idx < 7; idx++) {
                                color = (b & 0x01) ? back : fore;
                                data[off + 0] = color[0];
                                data[off + 1] = color[1];
                                data[off + 2] = color[2];
                                b >>= 1;
                                off += 4;
                            }
                            off += 553 * 4;
                        }
                    } else {
                        off = (col * 14 + row * 560 * 8) * 4;

                        for (jdx = 0; jdx < 8; jdx++) {
                            b = charset[val * 8 + jdx];
                            for (idx = 0; idx < 7; idx++) {
                                color = (b & 0x01) ? back : fore;
                                data[off + 0] = color[0];
                                data[off + 1] = color[1];
                                data[off + 2] = color[2];
                                data[off + 4] = color[0];
                                data[off + 5] = color[1];
                                data[off + 6] = color[2];
                                b >>= 1;
                                off += 8;
                            }
                            off += 546 * 4;
                        }
                    }
                } else {
                    if (_80colMode) {
                        off = (col * 14 + (bank ? 0 : 1) * 7 + row * 560 * 8) * 4;
                        for (jdx = 0; jdx < 8; jdx++) {
                            color = _colors[(jdx < 4) ? 
                                            (val & 0x0f) : (val >> 4)];
                            for (idx = 0; idx < 7; idx++) {
                                data[off + 0] = color[0];
                                data[off + 1] = color[1];
                                data[off + 2] = color[2];
                                off += 4;
                            }
                            off += 553 * 4;
                        }
                    } else {
                        off = (col * 14 + row * 560 * 8) * 4;

                        for (jdx = 0; jdx < 8; jdx++) {
                            color = _colors[(jdx < 4) ? 
                                            (val & 0x0f) : (val >> 4)];
                            for (idx = 0; idx < 7; idx++) {
                                data[off + 0] = color[0];
                                data[off + 1] = color[1];
                                data[off + 2] = color[2];
                                data[off + 4] = color[0];
                                data[off + 5] = color[1];
                                data[off + 6] = color[2];
                                off += 8;
                            }
                            off += 546 * 4;
                        }
                    }
                }
            }
        },
        refresh: function() {
            var page, off, addr = 0x400 * _page;
            _refreshing = true;
            for (var idx = 0; idx < 0x400; idx++, addr++) {
                page = addr >> 8;
                off = addr & 0xff;
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
        },
        blit: function() {
            context.putImageData(pages[_page], 0, 0);
        },
        getState: function() {
            return {
                page: _page,
                green: _green,
                buffer: [base64_encode(_buffer[0]),
                         base64_encode(_buffer[1])]
            };
        },
        setState: function(state) {
            _page = state.page;
            _green = state.green;
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
        [0x00,0x00,0x00], // 0 Black         0000 0   0
        [0x90,0x17,0x40], // 1 Red           0001 8   1
        [0x3c,0x22,0xa5], // 2 Dark Blue     1000 1
        [0xd0,0x43,0xe5], // 3 Purple        1001 9
        [0x00,0x69,0x40], // 4 Dark Green    0100 4
        [0xb0,0xb0,0xb0], // 5 Gray 1        0101 5
        [0x2f,0x95,0xe5], // 6 Medium Blue   1100 12
        [0xbf,0xab,0xff], // 7 Light Blue    1101 13
        [0x40,0x54,0x00], // 8 Brown         0010 2
        [0xd0,0x6a,0x1a], // 9 Orange        0011 3
        [0x40,0x40,0x40], // 10 Gray 2       1010 10
        [0xff,0x96,0xbf], // 11 Pink         1011 11
        [0x2f,0xbc,0x1a], // 12 Light Green  0110 6
        [0xb9,0xd0,0x60], // 13 Yellow       0111 7
        [0x6f,0xe8,0xbf], // 14 Aqua         1110 14
        [0xff,0xff,0xff]  // 15 White        1111 15
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

    var _green = false;
    var _garish = false;

    function _init() {
        _buffer[0] = allocMemPages(0x20);
        _buffer[1] = allocMemPages(0x20);
        for (var idx = 0; idx < 0x2000; idx++) {
            _buffer[0][idx] = 0; // idx & 0x2 ? 0xff : 0x00;
            _buffer[1][idx] = 0; // idx & 0x2 ? 0xff : 0x00;
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
            var addr = (page << 8) | off, base = addr - 0x2000 * _page,
            idx, jdx;
            if (_buffer[bank][base] == val && !_refreshing)
                return;
            _buffer[bank][base] = val;
            
            if (bank !== 0 && !doubleHiresMode)
                return;

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
                var b0, b1, b2, b3, b4, c;
                if (doubleHiresMode) {
                    // Every 4 bytes is 7 pixels
                    // 2 bytes per bank
                    var mod = col % 2, mcol = col - mod;
                    b0 = _buffer[1][base - mod];
                    b1 = _buffer[0][base - mod];
                    b2 = _buffer[1][base - mod + 1];
                    b3 = _buffer[0][base - mod + 1];
                    b4 = _buffer[1][base - mod + 2];
                    c = [((b0 & 0x0f) >> 0), // 0
                         ((b0 & 0x70) >> 4) | ((b1 & 0x01) << 3), // 1
                         ((b1 & 0x1e) >> 1), // 2
                         ((b1 & 0x60) >> 5) | ((b2 & 0x03) << 2), // 3
                         ((b2 & 0x3c) >> 2), // 4
                         ((b2 & 0x40) >> 6) | ((b3 & 0x07) << 1), // 5
                         ((b3 & 0x78) >> 3), // 6
                         0]; // 7
                    if (col < 39) {
                        c[7] = b4 & 0x0f;
                    }
                    dx = mcol * 14;
                    off = dx * 4 + dy * 280 * 4;

                    for (idx = 0; idx < 7; idx++) {
                        var dcolor = _green ? MONO : dcolors[r4[c[idx]]];
                        var bits = c[idx] | (c[idx + 1] << 4);
                        for (jdx = 0; jdx < 4; jdx++, off += 4) {
                            var saturate = !MONO && (_garish || bits & 0xe);
                            if (bits & 0x1 || saturate) {
                                data[off + 0] = dcolor[0];
                                data[off + 1] = dcolor[1];
                                data[off + 2] = dcolor[2];
                            } else {
                                data[off + 0] = 0; // dcolor[0] >> 1;
                                data[off + 1] = 0; // dcolor[1] >> 1;
                                data[off + 2] = 0; // dcolor[2] >> 1;
                            }
                            bits >>= 1;
                        }
                    }
                } else {
                    dx = col * 14 - 2;
                    b0 = col > 0 ? _buffer[bank][base - 1] : 0;
                    b2 = col < 39 ? _buffer[bank][base + 1] : 0;
                    val |= (b2 & 0x3) << 7;
                    var v0 = b0 & 0x20, v1 = b0 & 0x40, v2 = val & 0x1,
                    odd = !(col & 0x1), color, 
                    oddCol = (hbs ? orangeCol : greenCol),
                    evenCol = (hbs ? blueCol : violetCol);
                    
                    off = dx * 4 + dy * 280 * 4;
                    for (idx = 0; idx < 9; idx++, off += 8) {
                        val >>= 1;
                        if (v1) {
                            if (_green) {
                                color = MONO;
                            } else if (v0 || v2) {
                                color = whiteCol;
                            } else {
                                color = odd ? oddCol : evenCol;
                            }
                        } else {
                            if (_green) {
                                color = blackCol;
                            } else if (odd && v2 && (_garish || v0)) {
                                color = evenCol;
                            } else if (!odd && v0 && (_garish || v2)) {
                                color = oddCol;
                            } else {
                                color = blackCol;
                            }
                        }

                        if (dx > -1 && dx < 560) {
                            data[off + 0] = color[0];
                            data[off + 1] = color[1];
                            data[off + 2] = color[2];
                            data[off + 4] = color[0];
                            data[off + 5] = color[1];
                            data[off + 6] = color[2];
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
            _green = on;
            this.refresh();
        },
        garish: function(on) {
            _garish = on;
            this.refresh();
        },
        blit: function() {
            context.putImageData(pages[_page], 0, 0);
        },
        getState: function() {
            return {
                page: _page,
                green: _green,
                garish: _garish,
                buffer: [base64_encode(_buffer[0]),
                         base64_encode(_buffer[1])]
            };
        },
        setState: function(state) {
            _page = state.page;
            _green = state.green;
            _garish = state.garish;
            _buffer[0] = base64_decode(state.buffer[0]);
            _buffer[1] = base64_decode(state.buffer[1]);

            this.refresh();
        }
    };
}

function VideoModes(gr,hgr,gr2,hgr2) {
    var _grs = [gr, gr2];
    var _hgrs = [hgr, hgr2];

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
            var old = _80colMode;
            _80colMode = on;
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
            if (old != on) {
                _refresh();
            }
        },
        doublehires: function(on) {
            var old = doubleHiresMode;
            doubleHiresMode = on;
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

            pages[1] = c.createImageData(560, 192);
            pages[2] = c.createImageData(560, 192);
            for (var idx = 0; idx < 560 * 192 * 4; idx++) {
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
        },
        garish: function(on) {
            _hgrs[0].garish(on);
            _hgrs[1].garish(on);
        }
    };
}


