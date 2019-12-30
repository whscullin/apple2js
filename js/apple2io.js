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

import { debug } from './util';

export default function Apple2IO(cpu, callbacks)
{
    var _slot = [];
    var _auxRom = null;

    var _khz = 1023;
    var _rate = 44000;
    var _sample_size = 4096;

    var _cycles_per_sample;

    var _buffer = [];
    var _key = 0;
    var _keyDown = false;
    var _button = [false, false, false];
    var _paddle = [0.0, 0.0, 0.0, 0,0];
    var _phase = -1;
    var _sample = [];
    var _sampleTime = 0;
    var _didAudio = false;

    var _high = 0.5;
    var _low = -0.5;

    var _audioListener = null;

    var _trigger = 0;
    var _annunciators = [false, false, false, false];

    var _tape = [];
    var _tapeOffset = 0;
    var _tapeNext = 0;
    var _tapeCurrent = false;

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
        ACCEL:    0x74, // CPU Speed control
        SETIOUDIS:0x7E, // Enable double hires
        CLRIOUDIS:0x7F  // Disable double hires
    };

    function init() {
        _calcSampleRate();
    }

    function _debug() {
        // debug.apply(this, arguments);
    }

    function _tick() {
        var now = cpu.cycles();
        var phase = _phase > 0 ? _high : _low;
        for (; _sampleTime < now; _sampleTime += _cycles_per_sample) {
            _sample.push(phase);
            if (_sample.length >= _sample_size) {
                if (_audioListener) {
                    _audioListener(_didAudio ? _sample : []);
                }
                _sample = [];
                _didAudio = false;
            }
        }
    }

    function _calcSampleRate() {
        _cycles_per_sample = _khz * 1000 / _rate;
    }

    function _updateKHz(khz) {
        _khz = khz;
        _calcSampleRate();
    }

    init();

    function _access(off, val) {
        var result = 0;
        var now = cpu.cycles();
        var delta = now - _trigger;
        switch (off) {
        case LOC.CLR80VID:
            if (callbacks._80col && val !== undefined) {
                _debug('80 Column Mode off');
                callbacks._80col(false);
            }
            break;
        case LOC.SET80VID:
            if (callbacks._80col && val !== undefined) {
                _debug('80 Column Mode on');
                callbacks._80col(true);
            }
            break;
        case LOC.CLRALTCH:
            if (callbacks.altchar && val !== undefined) {
                _debug('Alt Char off');
                callbacks.altchar(false);
            }
            break;
        case LOC.SETALTCH:
            if (callbacks.altchar && val !== undefined) {
                _debug('Alt Char on');
                callbacks.altchar(true);
            }
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
            if (callbacks.isText)
                result = callbacks.isText() ? 0x80 : 0x0;
            break;
        case LOC.RDMIXED:
            if (callbacks.isMixed)
                result = callbacks.isMixed() ? 0x80 : 0x0;
            break;
        case LOC.RDPAGE2:
            if (callbacks.isPage2)
                result = callbacks.isPage2() ? 0x80 : 0x0;
            break;
        case LOC.RDHIRES:
            if (callbacks.isHires)
                result = callbacks.isHires() ? 0x80 : 0x0;
            break;
        case LOC.RD80VID:
            if (callbacks.is80Col)
                result = callbacks.is80Col() ? 0x80 : 0x0;
            break;
        case LOC.RDALTCH:
            if (callbacks.isAltChar)
                result = callbacks.isAltChar() ? 0x80 : 0x0;
            break;
        case LOC.SETAN0:
            _debug('Annunciator 0 on');
            _annunciators[0] = true;
            break;
        case LOC.SETAN1:
            _debug('Annunciator 1 on');
            _annunciators[1] = true;
            break;
        case LOC.SETAN2:
            _debug('Annunciator 2 on');
            _annunciators[2] = true;
            break;
        case LOC.SETAN3:
            _debug('Annunciator 3 on');
            _annunciators[3] = true;
            if (callbacks.doublehires) callbacks.doublehires(false);
            break;
        case LOC.CLRAN0:
            _debug('Annunciator 0 off');
            _annunciators[0] = false;
            break;
        case LOC.CLRAN1:
            _debug('Annunciator 1 off');
            _annunciators[1] = false;
            break;
        case LOC.CLRAN2:
            _debug('Annunciator 2 off');
            _annunciators[2] = false;
            break;
        case LOC.CLRAN3:
            _debug('Annunciator 3 off');
            _annunciators[3] = false;
            if (callbacks.doublehires) callbacks.doublehires(true);
            break;
        case LOC.SPEAKER:
            _phase = -_phase;
            _didAudio = true;
            _tick();
            break;
        case LOC.STROBE:
            _key &= 0x7f;
            if (_buffer.length > 0) {
                val =  _buffer.shift();
                if (val == '\n') {
                    val = '\r';
                }
                _key = val.charCodeAt(0) | 0x80;
            }
            result = (_keyDown ? 0x80 : 0x00) | _key;
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
        case LOC.ACCEL:
            if (val !== undefined) {
                _updateKHz(val & 0x01 ? 1023 : 4096);
            }
            break;
        case LOC.RDDHIRES:
            if (callbacks.isDoubleHires) {
                result = callbacks.isDoubleHires() ? 0x80 : 0x0;
            }
            break;
        case LOC.TAPEIN:
            if (_tapeOffset == -1) {
                _tapeOffset = 0;
                _tapeNext = now;
            }

            if (_tapeOffset < _tape.length) {
                _tapeCurrent = _tape[_tapeOffset][1];
                while (now >= _tapeNext) {
                    if ((_tapeOffset % 1000) === 0) {
                        debug('Read ' + (_tapeOffset / 1000));
                    }
                    _tapeCurrent = _tape[_tapeOffset][1];
                    _tapeNext += _tape[_tapeOffset++][0];
                }

            }

            result = _tapeCurrent ? 0x80 : 0x00;
        }

        if (val !== undefined) {
            result = undefined;
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
                var card = _slot[slot];
                if (card && card.ioSwitch) {
                    result = card.ioSwitch(off, val);
                }
            }

            return result;
        },

        reset: function apple2io_reset() {
            for (var slot = 0; slot < 8; slot++) {
                var card = _slot[slot];
                if (card && card.reset) {
                    card.reset();
                }
            }
            callbacks.reset();
        },

        blit: function apple2io_blit() {
            var card = _slot[3];
            if (card && card.blit) {
                return card.blit();
            }
            return false;
        },

        read: function apple2io_read(page, off) {
            var result = 0;
            var slot;
            var card;

            switch (page) {
            case 0xc0:
                result = this.ioSwitch(off, undefined);
                break;
            case 0xc1:
            case 0xc2:
            case 0xc3:
            case 0xc4:
            case 0xc5:
            case 0xc6:
            case 0xc7:
                slot = page & 0x0f;
                card = _slot[slot];
                if (_auxRom != card) {
                    // _debug('Setting auxRom to slot', slot);
                    _auxRom = card;
                }
                if (card) {
                    result = card.read(page, off);
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
            var card;

            switch (page) {
            case 0xc0:
                this.ioSwitch(off, val);
                break;
            case 0xc1:
            case 0xc2:
            case 0xc3:
            case 0xc4:
            case 0xc5:
            case 0xc6:
            case 0xc7:
                slot = page & 0x0f;
                card = _slot[slot];
                if (_auxRom != card) {
                    // _debug('Setting auxRom to slot', slot);
                    _auxRom = card;
                }
                if (card) {
                    card.write(page, off, val);
                }
                break;
            default:
                if (_auxRom) {
                    _auxRom.write(page, off, val);
                }
                break;
            }
        },

        getState: function apple2io_getState() {
            return {
                annunciators: _annunciators[0]
            };
        },
        setState: function apple2io_setState(state) {
            _annunciators = state.annunciators;
        },

        setSlot: function apple2io_setSlot(slot, card) {
            _slot[slot] = card;
        },

        keyDown: function apple2io_keyDown(ascii) {
            _keyDown = true;
            _key = ascii | 0x80;
        },

        keyUp: function apple2io_keyUp() {
            _keyDown = false;
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

        updateKHz: function apple2io_updateKHz(khz) {
            _updateKHz(khz);
        },

        getKHz: function apple2io_updateKHz() {
            return _khz;
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
            _calcSampleRate();
        },

        tick: function tick() {
            _tick();
            for (var idx = 0; idx < 8; idx++) {
                if (_slot[idx] && _slot[idx].tick) {
                    _slot[idx].tick();
                }
            }
        },

        addSampleListener: function addSampleListener(cb) {
            _audioListener = cb;
        },

        annunciator: function annunciator(idx) {
            return _annunciators[idx];
        },

        cycles: function apple2io_cycles() {
            return cpu.cycles();
        }
    };
}
