/* -*- mode: JavaScript; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* Copyright 2010-2014 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

/*jshint browser:true */
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
var scanlines = false;

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
    var _green = [0x00,0xff,0x80];

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
        [0xbf,0xd3,0x5a], // 13 Yellow       0111 7
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
                        b = charset[(val & 0x3f) * 8 + jdx];
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
                odd = !(col & 0x1), 
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

