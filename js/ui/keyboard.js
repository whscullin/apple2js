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

import { debug, toHex } from '../util';

export default function KeyBoard(cpu, io, e) {
    // keycode: [plain, cntl, shift]
    var keymap = {
        // Most of these won't happen
        0x00: [0x00, 0x00, 0x00], //
        0x01: [0x01, 0x01, 0x01], //
        0x02: [0x02, 0x02, 0x02], //
        0x03: [0x03, 0x03, 0x03], //
        0x04: [0x04, 0x04, 0x04], //
        0x05: [0x05, 0x05, 0x05], //
        0x06: [0x06, 0x06, 0x06], //
        0x07: [0x07, 0x07, 0x07], //
        0x08: [0x7F, 0x7F, 0x7F], // BS/DELETE
        0x09: [0x09, 0x09, 0x09], // TAB
        0x0A: [0x0A, 0x0A, 0x0A], //
        0x0B: [0x0B, 0x0B, 0x0B], //
        0x0C: [0x0C, 0x0C, 0x0C], //
        0x0D: [0x0D, 0x0D, 0x0D], // CR
        0x0E: [0x0E, 0x0E, 0x0E], //
        0x0F: [0x0F, 0x0F, 0x0F], //

        0x10: [0xff, 0xff, 0xff], // SHIFT
        0x11: [0xff, 0xff, 0xff], // CTRL
        0x12: [0xff, 0xff, 0xff], // ALT/OPTION
        0x13: [0x13, 0x13, 0x13], //
        0x14: [0x14, 0x14, 0x14], //
        0x15: [0x15, 0x15, 0x15], //
        0x16: [0x16, 0x16, 0x16], //
        0x17: [0x17, 0x17, 0x18], //
        0x18: [0x18, 0x18, 0x18], //
        0x19: [0x19, 0x19, 0x19], //
        0x1A: [0x1A, 0x1A, 0x1A], //
        0x1B: [0x1B, 0x1B, 0x1B], // ESC
        0x1C: [0x1C, 0x1C, 0x1C], //
        0x1D: [0x1D, 0x1D, 0x1D], //
        0x1E: [0x1E, 0x1E, 0x1E], //
        0x1F: [0x1F, 0x1F, 0x1F], //

        // Most of these besides space won't happen
        0x20: [0x20, 0x20, 0x20], //
        0x21: [0x21, 0x21, 0x21], //
        0x22: [0x22, 0x22, 0x22], //
        0x23: [0x23, 0x23, 0x23], //
        0x24: [0x24, 0x24, 0x24], //
        0x25: [0x08, 0x08, 0x08], // <- left
        0x26: [0x0B, 0x0B, 0x0B], // ^ up
        0x27: [0x15, 0x15, 0x15], // -> right
        0x28: [0x0A, 0x0A, 0x0A], // v down
        0x29: [0x29, 0x29, 0x29], // )
        0x2A: [0x2A, 0x2A, 0x2A], // *
        0x2B: [0x2B, 0x2B, 0x2B], // +
        0x2C: [0x2C, 0x2C, 0x3C], // , - <
        0x2D: [0x2D, 0x2D, 0x5F], // - - _
        0x2E: [0x2E, 0x2E, 0x3E], // . - >
        0x2F: [0x2F, 0x2F, 0x3F], // / - ?

        0x30: [0x30, 0x30, 0x29], // 0 - )
        0x31: [0x31, 0x31, 0x21], // 1 - !
        0x32: [0x32, 0x00, 0x40], // 2 - @
        0x33: [0x33, 0x33, 0x23], // 3 - #
        0x34: [0x34, 0x34, 0x24], // 4 - $
        0x35: [0x35, 0x35, 0x25], // 5 - %
        0x36: [0x36, 0x36, 0x5E], // 6 - ^
        0x37: [0x37, 0x37, 0x26], // 7 - &
        0x38: [0x38, 0x38, 0x2A], // 8 - *
        0x39: [0x39, 0x39, 0x28], // 9 - (
        0x3A: [0x3A, 0x3A, 0x3A], // :
        0x3B: [0x3B, 0x3B, 0x3A], // ; - :
        0x3C: [0x3C, 0x3C, 0x3C], // <
        0x3D: [0x3D, 0x3D, 0x2B], // = - +
        0x3E: [0x3E, 0x3E, 0x3E], // >
        0x3F: [0x3F, 0x3F, 0x3F], // ?

        // Alpha and control
        0x40: [0x40, 0x00, 0x40], // @
        0x41: [0x61, 0x01, 0x41], // A
        0x42: [0x62, 0x02, 0x42], // B
        0x43: [0x63, 0x03, 0x43], // C - BRK
        0x44: [0x64, 0x04, 0x44], // D
        0x45: [0x65, 0x05, 0x45], // E
        0x46: [0x66, 0x06, 0x46], // F
        0x47: [0x67, 0x07, 0x47], // G - BELL
        0x48: [0x68, 0x08, 0x48], // H
        0x49: [0x69, 0x09, 0x49], // I - TAB
        0x4A: [0x6A, 0x0A, 0x4A], // J - NL
        0x4B: [0x6B, 0x0B, 0x4B], // K - VT
        0x4C: [0x6C, 0x0C, 0x4C], // L
        0x4D: [0x6D, 0x0D, 0x4D], // M - CR
        0x4E: [0x6E, 0x0E, 0x4E], // N
        0x4F: [0x6F, 0x0F, 0x4F], // O

        0x50: [0x70, 0x10, 0x50], // P
        0x51: [0x71, 0x11, 0x51], // Q
        0x52: [0x72, 0x12, 0x52], // R
        0x53: [0x73, 0x13, 0x53], // S
        0x54: [0x74, 0x14, 0x54], // T
        0x55: [0x75, 0x15, 0x55], // U
        0x56: [0x76, 0x16, 0x56], // V
        0x57: [0x77, 0x17, 0x57], // W
        0x58: [0x78, 0x18, 0x58], // X
        0x59: [0x79, 0x19, 0x59], // Y
        0x5A: [0x7A, 0x1A, 0x5A], // Z
        0x5B: [0xFF, 0xFF, 0xFF], // Left window
        0x5C: [0xFF, 0xFF, 0xFF], // Right window
        0x5D: [0xFF, 0xFF, 0xFF], // Select
        0x5E: [0x5E, 0x1E, 0x5E], //
        0x5F: [0x5F, 0x1F, 0x5F], // _

        // Numeric pad
        0x60: [0x30, 0x30, 0x30], // 0
        0x61: [0x31, 0x31, 0x31], // 1
        0x62: [0x32, 0x32, 0x32], // 2
        0x63: [0x33, 0x33, 0x33], // 3
        0x64: [0x34, 0x34, 0x34], // 4
        0x65: [0x35, 0x35, 0x35], // 5
        0x66: [0x36, 0x36, 0x36], // 6
        0x67: [0x37, 0x37, 0x37], // 7
        0x68: [0x38, 0x38, 0x38], // 8
        0x69: [0x39, 0x39, 0x39], // 9

        0x6A: [0x2A, 0x2A, 0x2A], // *
        0x6B: [0x2B, 0x2B, 0x2B], // +
        0x6D: [0x2D, 0x2D, 0x2D], // -
        0x6E: [0x2E, 0x2E, 0x2E], // .
        0x6F: [0x2F, 0x2F, 0x39], // /

        // Stray keys
        0xAD: [0x2D, 0x2D, 0x5F], // - - _
        0xBA: [0x3B, 0x3B, 0x3A], // ; - :
        0xBB: [0x3D, 0x3D, 0x2B], // = - +
        0xBC: [0x2C, 0x2C, 0x3C], // , - <
        0xBD: [0x2D, 0x2D, 0x5F], // - - _
        0xBE: [0x2E, 0x2E, 0x3E], // . - >
        0xBF: [0x2F, 0x2F, 0x3F], // / - ?
        0xC0: [0x60, 0x60, 0x7E], // ` - ~
        0xDB: [0x5B, 0x1B, 0x7B], // [ - {
        0xDC: [0x5C, 0x1C, 0x7C], // \ - |
        0xDD: [0x5D, 0x1D, 0x7D], // ] - }
        0xDE: [0x27, 0x22, 0x22], // ' - '

        0xFF: [0xFF, 0xFF, 0xFF] // No comma line
    };

    var uiKitMap = {
        'Dead': 0xFF,
        'UIKeyInputLeftArrow': 0x08,
        'UIKeyInputRightArrow': 0x15,
        'UIKeyInputUpArrow': 0x0B,
        'UIKeyInputDownArrow': 0x0A,
        'UIKeyInputEscape': 0x1B
    };

    var keys2 = [
        [
            ['1','2','3','4','5','6','7','8','9','0',':','-','RESET'],
            ['ESC','Q','W','E','R','T','Y','U','I','O','P','REPT','RETURN'],
            ['CTRL','A','S','D','F','G','H','J','K','L',';','&larr;','&rarr;'],
            ['SHIFT','Z','X','C','V','B','N','M',',','.','/','SHIFT'],
            ['POWER', '&nbsp;']
        ], [
            ['!','"','#','$','%','&','\'','(',')','0','*','=','RESET'],
            ['ESC','Q','W','E','R','T','Y','U','I','O','@','REPT','RETURN'],
            ['CTRL','A','S','D','F','BELL','H','J','K','L','+','&larr;','&rarr;'],
            ['SHIFT','Z','X','C','V','B','^',']','<','>','?','SHIFT'],
            ['POWER', '&nbsp;']
        ]
    ];

    var keys2e = [
        [
            ['ESC','1','2','3','4','5','6','7','8','9','0','-','=','DELETE'],
            ['TAB','Q','W','E','R','T','Y','U','I','O','P','[',']','\\'],
            ['CTRL','A','S','D','F','G','H','J','K','L',';','"','RETURN'],
            ['SHIFT','Z','X','C','V','B','N','M',',','.','/','SHIFT'],
            ['LOCK','`','POW','OPEN_APPLE','&nbsp;','CLOSED_APPLE','&larr;','&rarr;','&darr;','&uarr;']
        ], [
            ['ESC','!','@','#','$','%','^','&','*','(',')','_','+','DELETE'],
            ['TAB','Q','W','E','R','T','Y','U','I','O','P','{','}','|'],
            ['CTRL','A','S','D','F','G','H','J','K','L',':','\'','RETURN'],
            ['SHIFT','Z','X','C','V','B','N','M','<','>','?','SHIFT'],
            ['CAPS','~','POW','OPEN_APPLE','&nbsp;','CLOSED_APPLE','&larr;','&rarr;','&darr;','&uarr;']
        ]
    ];

    var keys = e ? keys2e : keys2;

    var shifted = false;
    var controlled = false;
    var capslocked = true;
    // Initially caps lock on physical keyboard is assumed to be off,
    // but on emulated keyboard it is on.
    var capslockKeyUsed = false;
    var optioned = false;
    var commanded = false;

    var kb;

    return {
        mapKeyEvent: function keyboard_mapKeyEvent(evt) {
            var code = evt.keyCode, key = 0xff;

            if (evt.key in uiKitMap) {
                key = uiKitMap[evt.key];
            } else if (code in keymap) {
                key = keymap[code][evt.shiftKey ? 2 : (evt.ctrlKey ? 1 : 0)];

                if (code != 20 && capslockKeyUsed) {
                    this.capslockKey(evt.getModifierState('CapsLock'));
                }

                if (capslocked && key >= 0x61 && key <= 0x7A) {
                    key -= 0x20;
                }
            } else {
                debug('Unhandled key = ' + toHex(code));
            }

            if (key == 0x7F && evt.shiftKey && evt.ctrlKey) {
                cpu.reset();
                key = 0xff;
            }

            return key;
        },

        shiftKey: function keyboard_shiftKey(down) {
            var shiftKeys = kb.querySelectorAll('.key-SHIFT');
            shifted = down;
            if (down) {
                io.buttonUp(2);
                shiftKeys.forEach(function(key) { key.classList.add('active'); });
            } else {
                io.buttonDown(2);
                shiftKeys.forEach(function(key) { key.classList.remove('active'); });
            }
        },

        controlKey: function keyboard_controlKey(down) {
            var ctrlKey = kb.querySelector('.key-CTRL');
            controlled = down;
            if (down) {
                ctrlKey.classList.add('active');
            } else {
                ctrlKey.classList.remove('active');
            }
        },

        commandKey: function keyboard_commandKey(down) {
            var commandKey = kb.querySelector('.key-OPEN_APPLE');
            if (!commandKey) {
                return;
            }
            commanded = down;
            if (down) {
                io.buttonDown(0);
                commandKey.classList.add('active');
            } else {
                io.buttonUp(0);
                commandKey.classList.remove('active');
            }
        },

        optionKey: function keyboard_optionKey(down) {
            var optionKey = kb.querySelector('.key-CLOSED_APPLE');
            if (!optionKey) {
                return;
            }
            optioned = down;
            if (down) {
                io.buttonDown(1);
                optionKey.classList.add('active');
            } else {
                io.buttonUp(1);
                optionKey.classList.remove('active');
            }
        },

        capslockKey: function keyboard_caplockKey(down) {
            var capsLock = kb.querySelector('.key-LOCK');

            if (arguments.length == 0) {
                if (capslockKeyUsed) {
                    capslocked = !capslocked;
                } else {
                    capslockKeyUsed = true;
                }
            } else if (down === undefined) {
                capslocked = !capslocked;
                capslockKeyUsed = false;
            } else {
                capslocked = down;
            }

            if (capslocked) {
                capsLock.classList.add('active');
            } else {
                capsLock.classList.remove('active');
            }
        },

        reset: function keyboard_reset(event) {
            event.preventDefault();
            event.stopPropagation();
            cpu.reset();
        },

        create: function keyboard_create(el) {
            kb = document.querySelector(el);
            var x, y, row, key, key1, key2, label, label1, label2, self = this;

            function buildLabel(k) {
                var span = document.createElement('span');
                span.innerHTML = k;
                if (k.length > 1 && k.substr(0,1) != '&')
                    span.classList.add('small');
                return span;
            }

            function _mouseup() {
                this.classList.remove('pressed');
            }

            function _mousedown(ev) {
                ev.preventDefault();
                this.classList.add('pressed');
                var key = this.dataset[shifted ? 'key2' : 'key1'];
                switch (key) {
                    case 'BELL':
                        key = 'G';
                        break;
                    case 'RETURN':
                        key = '\r';
                        break;
                    case 'TAB':
                        key = '\t';
                        break;
                    case 'DELETE':
                        key = '\x7F';
                        break;
                    case '&larr;':
                        key = '\x08';
                        break;
                    case '&rarr;':
                        key = '\x15';
                        break;
                    case '&darr;':
                        key = '\x0A';
                        break;
                    case '&uarr;':
                        key = '\x0B';
                        break;
                    case '&nbsp;':
                        key = ' ';
                        break;
                    case 'ESC':
                        key = '\x1B';
                        break;
                    default:
                        break;
                }

                if (key.length > 1) {
                    switch (key) {
                        case 'SHIFT':
                            self.shiftKey(!shifted);
                            break;
                        case 'CTRL':
                            self.controlKey(!controlled);
                            break;
                        case 'CAPS':
                        case 'LOCK':
                            self.capslockKey(undefined);
                            break;
                        case 'POW':
                        case 'POWER':
                            if (window.confirm('Power Cycle?'))
                                window.location.reload();
                            break;
                        case 'RESET':
                            cpu.reset();
                            break;
                        case 'OPEN_APPLE':
                            self.commandKey(!commanded);
                            break;
                        case 'CLOSED_APPLE':
                            self.optionKey(!optioned);
                            break;
                        default:
                            break;
                    }
                } else {
                    if (controlled && key >= '@' && key <= '_') {
                        io.keyDown(key.charCodeAt(0) - 0x40);
                    } else if (!e && !shifted && !capslocked &&
                               key >= 'A' && key <= 'Z') {
                        io.keyDown(key.charCodeAt(0) + 0x20);
                    } else {
                        io.keyDown(key.charCodeAt(0));
                    }
                }
            }

            for (y = 0; y < 5; y++) {
                row = document.createElement('div');
                row.classList.add('row');
                row.classList.add('row' + y);
                kb.append(row);
                for (x = 0; x < keys[0][y].length; x++) {
                    key1 = keys[0][y][x];
                    key2 = keys[1][y][x];

                    label = document.createElement('div');
                    label1 = buildLabel(key1);
                    label2 = buildLabel(key2);

                    key = document.createElement('div');
                    key.classList.add('key');
                    key.classList.add('key-' + key1.replace(/[&#;]/g,''));

                    if (key1.length > 1) {
                        if (key1 == 'LOCK')
                            key.classList.add('v-center2');
                        else
                            key.classList.add('v-center');
                    }
                    if (key1 != key2) {
                        key.classList.add('key-' + key2.replace(/[&;]/g,''));
                        label.append(label2);
                        label.append(document.createElement('br'));
                    }
                    if (key1 == 'LOCK') {
                        key.classList.add('active');
                    }

                    label.append(label1);
                    key.append(label);
                    key.dataset.key1 = key1;
                    key.dataset.key2 = key2;

                    if (window.ontouchstart === undefined) {
                        key.addEventListener('mousedown', _mousedown);
                        key.addEventListener('mouseup', _mouseup);
                        key.addEventListener('mouseleave', _mouseup);
                    } else {
                        key.addEventListener('touchstart', _mousedown);
                        key.addEventListener('touchend', _mouseup);
                        key.addEventListener('touchleave', _mouseup);
                    }

                    row.append(key);
                }
            }
        }
    };
}
