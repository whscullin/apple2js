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

/*globals allocMemPages: false, 
          charset: false, 
          base64_encode: false, base64_decode: false */
/*exported LoresPage, HiresPage, VideoModes*/

/*
 * Text Page 1 Drawing
 */

var textMode = true;
var mixedMode = true;
var hiresMode = false;
var pageMode = 1;
var pages = [];
var context = null;

function LoresPage(page) 
{
    var _page = page;
    var _buffer = [];
    var _refreshing = false;
    var _greenMode = false;

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

        /* Alternate from http://mrob.com/pub/xapple2/colors.html
        [  0,  0,  0], //  0 Black
        [227, 30, 96], //  1 Red
        [ 96, 78,189], //  2 Dark Blue
        [255, 68,253], //  3 Purple
        [  0,163, 96], //  4 Dark Green
        [156,156,156], //  5 Grey
        [ 20,207,253], //  6 Med Blue
        [208,195,255], //  7 Light Blue
        [ 96,114,  3], //  8 Brown
        [255,106, 60], //  9 Orange
        [156,156,156], // 10 Grey
        [255,160,208], // 11 Pink
        [ 20,245, 60], // 12 Light Green
        [208,221,141], // 13 Yellow
        [114,255,208], // 14 Aqua
        [255,255,255]  // 15 White
        */
    ];

    function _init() {
        _buffer = allocMemPages(0x4);

        for (var idx = 0; idx < 0x400; idx++) {
            _buffer[idx] = 0; // Math.floor(Math.random()*256);
        }
    }

    _init();

    return {
        start: function() { return (0x04 * _page); },
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
                off = (col * 7 + row * 280 * 8) * 4;

                if (textMode || (mixedMode && row > 19)) {
                    if (val & 0x80) {
                        fore = _greenMode ? _green : _white;
                        back = _black;
                    } else {
                        fore = _black;
                        back = _greenMode ? _green : _white;
                    }
                    for (jdx = 0; jdx < 8; jdx++) {
                        b = charset[(val & 0x3f) * 8 + jdx];
                        b <<= 1;
                        for (idx = 0; idx < 7; idx++) {
                            color = (b & 0x80) ? fore : back;
                            data[off + 0] = color[0];
                            data[off + 1] = color[1];
                            data[off + 2] = color[2];
                            b <<= 1;
                            off += 4;
                        }
                        off += 273 * 4;
                    }
                } else {
                    for (jdx = 0; jdx < 8; jdx++) {
                        color = _colors[(jdx < 4) ? (val & 0x0f) : (val >> 4)];
                        for (idx = 0; idx < 7; idx++) {
                            data[off + 0] = color[0];
                            data[off + 1] = color[1];
                            data[off + 2] = color[2];
                            off += 4;
                        }
                        off += 273 * 4;
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

    var _green = false;

    function _init() {
        _buffer = allocMemPages(0x20);

        for (var idx = 0; idx < 0x2000; idx++)
            _buffer[idx] = 0; // Math.floor(Math.random()*256);
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
                dx = col * 7 - 1,
                b0 = col > 0 ? _buffer[base - 1] : 0,
                b2 = col < 39 ? _buffer[base + 1] : 0;
                val |= (b2 & 0x3) << 7;
                var v0 = b0 & 0x20, v1 = b0 & 0x40, v2 = val & 0x1,
                odd = !(col & 0x1), 
                color, 
                oddCol = (hbs ? orangeCol : greenCol),
                evenCol = (hbs ? blueCol : violetCol);

                off = dx * 4 + dy * 280 * 4;
                for (var idx = 0; idx < 9; idx++, off += 4) {
                    val >>= 1;

                    if (v1) {
                        if (_green) {
                            color = greenCol;
                        } else if (v0 || v2) {
                            color = whiteCol;
                        } else {
                            color = odd ? oddCol : evenCol;
                        }
                    } else {
                        if (_green) {
                            color = blackCol;
                        } else if (odd && v0 && v2) {
                            color = evenCol;
                        } else if (!odd && v0 && v2) {
                            color = oddCol;
                        } else {
                            color = blackCol;
                        }
                    }

                    if (dx > -1 && dx < 280) {
                        data[off + 0] = color[0];
                        data[off + 1] = color[1];
                        data[off + 2] = color[2];
                    }
                    dx++;

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
            _green = on;
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

            pages[1] = context.createImageData(280, 192);
            pages[2] = context.createImageData(280, 192);
            for (var idx = 0; idx < 280 * 192 * 4; idx++) {
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

