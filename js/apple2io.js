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

/*globals debug: false */
/*exported Apple2IO */

function Apple2IO(cpu, callbacks)
{
    'use strict';

    var _slot = [];
    var _auxRom = null;

    var _hz = 1023000;
    var _rate = 44000;
    var _sample_size = 4096;

    var _cycles_per_sample = _hz / _rate;

    var _buffer = [];
    var _key = 0;
    var _keyDown = false;
    var _button = [false, false, false];
    var _paddle = [0.0, 0.0, 0.0, 0,0];
    var _phase = -1;
    var _sample = [];
    var _sampleTime = 0;

    var _high = 0.5;
    var _low = -0.5;

    var _audioListener = null;

    var _trigger = 0;

    var _tape = [];
    var _tapeOffset = 0;
    var _tapeNext = 0;
    var _tapeFlip = false;

    var LOC = {
        KEYBOARD: 0x00, // keyboard data (latched) (Read),
        CLR80VID: 0x0C, // clear 80 column mode
        SET80VID: 0x0D, // set 80 column mode
        CLRALTCH: 0x0E, // clear mousetext
        SETALTCH: 0x0F, // set mousetext
        STROBE:   0x10, // clear bit 7 of keyboard data ($C000)

        RDTEXT:   0x1A, // using text mode
        RDMIXED:  0x1B, // using mixed mode
        RDPAGE2:  0x1C, // using text/graphics page2
        RDHIRES:  0x1D, // using Hi-res graphics mode
        RDALTCH:  0x1E, // using alternate character set
        RD80VID:  0x1F, // using 80-column display mode

        TAPEOUT:  0x20, // toggle the cassette output.
        SPEAKER:  0x30, // toggle speaker diaphragm
        CLRTEXT:  0x50, // display graphics
        SETTEXT:  0x51, // display text
        CLRMIXED: 0x52, // clear mixed mode- enable full graphics
        SETMIXED: 0x53, // enable graphics/text mixed mode
        PAGE1:    0x54, // select text/graphics page1
        PAGE2:    0x55, // select text/graphics page2
        CLRHIRES: 0x56, // select Lo-res
        SETHIRES: 0x57, // select Hi-res
        CLRAN0:   0x58, // Set annunciator-0 output to 0
        SETAN0:   0x59, // Set annunciator-0 output to 1
        CLRAN1:   0x5A, // Set annunciator-1 output to 0
        SETAN1:   0x5B, // Set annunciator-1 output to 1
        CLRAN2:   0x5C, // Set annunciator-2 output to 0
        SETAN2:   0x5D, // Set annunciator-2 output to 1
        CLRAN3:   0x5E, // Set annunciator-3 output to 0
        SETAN3:   0x5F, // Set annunciator-3 output to 1
        TAPEIN:   0x60, // bit 7: data from cassette
        PB0:      0x61, // game Pushbutton 0 / open apple (command) key data
        PB1:      0x62, // game Pushbutton 1 / closed apple (option) key data
        PB2:      0x63, // game Pushbutton 2 (read)
        PADDLE0:  0x64, // bit 7: status of pdl-0 timer (read)
        PADDLE1:  0x65, // bit 7: status of pdl-1 timer (read)
        PADDLE2:  0x66, // bit 7: status of pdl-2 timer (read)
        PADDLE3:  0x67, // bit 7: status of pdl-3 timer (read)
        PDLTRIG:  0x70, // trigger paddles
        BANK:     0x73, // Back switched RAM card bank
        SETIOUDIS:0x7E, // Enable double hires
        CLRIOUDIS:0x7F  // Disable double hires
    };

    function _debug() {
        debug.apply(arguments);
    }

    function _tick() {
        var now = cpu.cycles();
        var phase = _phase > 0 ? _high : _low;
        for (; _sampleTime < now; _sampleTime += _cycles_per_sample) {
            _sample.push(phase);
            if (_sample.length >= _sample_size) {
                if (_audioListener) {
                    _audioListener(_sample);
                }
                _sample = [];
            }
        }
    }

    function _access(off) {
        var result = 0;
        var now = cpu.cycles();
        var delta = now - _trigger;
        switch (off) {
        case LOC.CLR80VID:
            // _debug('80 Column Mode off');
            if ('_80col' in callbacks) callbacks._80col(false);
            break;
        case LOC.SET80VID:
            // _debug('80 Column Mode on');
            if ('_80col' in callbacks) callbacks._80col(true);
            break;
        case LOC.CLRALTCH:
            // _debug('Alt Char off');
            if ('altchar' in callbacks) callbacks.altchar(false);
            break;
        case LOC.SETALTCH:
            // _debug('Alt Char on');
            if ('altchar' in callbacks) callbacks.altchar(true);
            break;
        case LOC.CLRTEXT:
            _debug('Graphics Mode');
            callbacks.text(false);
            break;
        case LOC.SETTEXT:
            _debug('Text Mode');
            callbacks.text(true);
            break;
        case LOC.CLRMIXED:
            _debug('Mixed Mode off');
            callbacks.mixed(false);
            break;
        case LOC.SETMIXED:
            _debug('Mixed Mode on');
            callbacks.mixed(true);
            break;
        case LOC.CLRHIRES:
            _debug('LoRes Mode');
            callbacks.hires(false);
            break;
        case LOC.SETHIRES:
            _debug('HiRes Mode');
            callbacks.hires(true);
            break;
        case LOC.PAGE1:
            callbacks.page(1);
            break;
        case LOC.PAGE2:
            callbacks.page(2);
            break;
        case LOC.RDTEXT:
            if ('isText' in callbacks)
                result = callbacks.isText() ? 0x80 : 0x0;
            break;
        case LOC.RDMIXED:
            if ('isMixed' in callbacks)
                result = callbacks.isMixed() ? 0x80 : 0x0;
            break;
        case LOC.RDPAGE2:
            if ('isPage2' in callbacks)
                result = callbacks.isPage2() ? 0x80 : 0x0;
            break;
        case LOC.RDHIRES:
            if ('isHires' in callbacks)
                result = callbacks.isHires() ? 0x80 : 0x0;
            break;
        case LOC.RD80VID:
            if ('is80Col' in callbacks)
                result = callbacks.is80Col() ? 0x80 : 0x0;
            break;
        case LOC.RDALTCH:
            if ('isAltChar' in callbacks)
                result = callbacks.isAltChar() ? 0x80 : 0x0;
            break;
        case LOC.SETAN0:
            _debug('Annunciator 0 on');
            if ('annunciator' in callbacks) callbacks.annunicator(0, true);
            break;
        case LOC.SETAN1:
            _debug('Annunciator 1 on');
            if ('annunciator' in callbacks) callbacks.annunicator(1, true);
            break;
        case LOC.SETAN2:
            _debug('Annunciator 2 on');
            if ('annunciator' in callbacks) callbacks.annunicator(2, true);
            break;
        case LOC.SETAN3:
            _debug('Annunciator 3 on');
            if ('annunciator' in callbacks) callbacks.annunicator(3, true);
            if ('doublehires' in callbacks) callbacks.doublehires(false);
            break;
        case LOC.CLRAN0:
            _debug('Annunciator 0 off');
            if ('annunciator' in callbacks) callbacks.annunicator(0, false);
            break;
        case LOC.CLRAN1:
            _debug('Annunciator 1 off');
            if ('annunciator' in callbacks) callbacks.annunicator(1, false);
            break;
        case LOC.CLRAN2:
            _debug('Annunciator 2 off');
            if ('annunciator' in callbacks) callbacks.annunicator(2, false);
            break;
        case LOC.CLRAN3:
            _debug('Annunciator 3 off');
            if ('annunciator' in callbacks) callbacks.annunicator(3, false);
            if ('doublehires' in callbacks) callbacks.doublehires(true);
            break;
        case LOC.SPEAKER:
            _phase = -_phase;
            _tick();
            break;
        case LOC.STROBE:
            _key &= 0x7f;
            if (_buffer.length > 0) {
                var val =  _buffer.shift();
                if (val == '\n') {
                    val = '\r';
                }
                _key = val.charCodeAt(0) | 0x80;
            }
            result = _keyDown ? 0x80 : 0x00;
            break;
        case LOC.KEYBOARD:
            result = _key;
            break;
        case LOC.PB0:
            result = _button[0] ? 0x80 : 0;
            break;
        case LOC.PB1:
            result = _button[1] ? 0x80 : 0;
            break;
        case LOC.PB2:
            result = _button[2] ? 0x80 : 0;
            break;
        case LOC.PADDLE0:
            result = (delta < (_paddle[0] * 2756) ? 0x80 : 0x00);
            break;
        case LOC.PADDLE1:
            result = (delta < (_paddle[1] * 2756) ? 0x80 : 0x00);
            break;
        case LOC.PADDLE2:
            result = (delta < (_paddle[2] * 2756) ? 0x80 : 0x00);
            break;
        case LOC.PADDLE3:
            result = (delta < (_paddle[3] * 2756) ? 0x80 : 0x00);
            break;
        case LOC.PDLTRIG:
            _trigger = cpu.cycles();
            break;
        case LOC.TAPEIN:
            // var flipped = false;
            if (_tapeOffset == -1) {
                _tapeOffset = 0;
                _tapeNext = now;
            }
            if (_tapeOffset < _tape.length) {
                while (now >= _tapeNext) {
                    if ((_tapeOffset % 1000) === 0) {
                        debug('Read ' + (_tapeOffset / 1000));
                    }
                    _tapeFlip = !_tapeFlip;
                    // flipped = true;
                    _tapeNext += _tape[_tapeOffset++];
                }
                result = _tapeFlip ? 0x80 : 0x00;
            }
            /*
            if (flipped) {
                debug('now=' + now + ' next=' + _tapeNext + ' (' + (_tapeNext - now) + ')');
            }
            */

            /*
            var progress =
                Math.round(_tapeOffset / _tapeBuffer.length * 100) / 100;

            if (_progress != progress) {
                _progress = progress;
                cb.progress(_progress);
            }
            */
        }
        return result;
    }

    return {
        start: function apple2io_start() {
            return 0xc0;
        },
        end: function apple2io_end() {
            return 0xcf;
        },

        ioSwitch: function apple2io_ioSwitch(off, val) {
            var result;
            if (off < 0x80) {
                result = _access(off, val);
            } else {
                var slot = (off & 0x70) >> 4;
                if (_slot[slot]) {
                    result = _slot[slot].ioSwitch(off, val);
                }
            }

            return result;
        },

        read: function apple2io_read(page, off) {
            var result = 0;
            var slot;
            switch (page) {
            case 0xc0:
                result = this.ioSwitch(off);
                break;
            case 0xc1:
            case 0xc2:
            case 0xc3:
            case 0xc4:
            case 0xc5:
            case 0xc6:
            case 0xc7:
                slot = page & 0x0f;
                _auxRom = _slot[slot];
                if (_slot[slot]) {
                    result = _slot[slot].read(page, off);
                }
                break;
            default:
                if (_auxRom) {
                    result = _auxRom.read(page, off);
                }
                break;
            }
            return result;
        },

        write: function apple2io_write(page, off, val) {
            var slot;
            switch (page) {
            case 0xc0:
                this.ioSwitch(off);
                break;
            case 0xc1:
            case 0xc2:
            case 0xc3:
            case 0xc4:
            case 0xc5:
            case 0xc6:
            case 0xc7:
                slot = page & 0x0f;
                _auxRom = _slot[slot];
                if (_slot[slot]) {
                    _slot[slot].write(page, off, val);
                }
                break;
            default:
                if (_auxRom) {
                    _auxRom.write(page, off, val);
                }
                break;
            }
        },

        getState: function apple2io_getState() { return {}; },
        setState: function apple2io_setState() { },

        addSlot: function apple2io_addSlot(slot, card) {
            _slot[slot] = card;
        },

        keyDown: function apple2io_keyDown(ascii) {
            _keyDown = true;
            _key = ascii | 0x80;
        },

        keyUp: function apple2io_keyUp() {
            _keyDown = false;
            _key = 0;
        },

        buttonDown: function apple2io_buttonDown(b) {
            _button[b] = true;
        },

        buttonUp: function apple2io_buttonUp(b) {
            _button[b] = false;
        },

        paddle: function apple2io_paddle(p, v) {
            _paddle[p] = v;
        },

        updateHz: function apple2io_updateHz(hz) {
            _hz = hz;

            _cycles_per_sample = _hz / _rate;
        },
        setKeyBuffer: function apple2io_setKeyBuffer(buffer) {
            _buffer = buffer.split('');
            if (_buffer.length > 0) {
                _keyDown = true;
                _key = _buffer.shift().charCodeAt(0) | 0x80;
            }
        },

        setTape: function apple2io_setTape(tape) {
            debug('Tape length: ' + tape.length);
            _tape = tape;
            _tapeOffset = -1;
        },

        sampleRate: function sampleRate(rate) {
            _rate = rate;
            _cycles_per_sample = _hz / _rate;
        },

        sampleTick: function sampleTick() {
            _tick();
        },

        addSampleListener: function addSampleListener(cb) {
            _audioListener = cb;
        }
    };
}
