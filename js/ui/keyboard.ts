import { byte, DeepMemberOf, KnownKeys } from '../types';
import Apple2IO from '../apple2io';
import { CPU6502 } from '@whscullin/cpu6502';
import { debug, toHex } from '../util';

// keycode: [plain, cntl, shift]
const keymap = {
    // Most of these won't happen
    0x00: [0x00, 0x00, 0x00], //
    0x01: [0x01, 0x01, 0x01], //
    0x02: [0x02, 0x02, 0x02], //
    0x03: [0x03, 0x03, 0x03], //
    0x04: [0x04, 0x04, 0x04], //
    0x05: [0x05, 0x05, 0x05], //
    0x06: [0x06, 0x06, 0x06], //
    0x07: [0x07, 0x07, 0x07], //
    0x08: [0x7f, 0x7f, 0x7f], // BS/DELETE
    0x09: [0x09, 0x09, 0x09], // TAB
    0x0a: [0x0a, 0x0a, 0x0a], //
    0x0b: [0x0b, 0x0b, 0x0b], //
    0x0c: [0x0c, 0x0c, 0x0c], //
    0x0d: [0x0d, 0x0d, 0x0d], // CR
    0x0e: [0x0e, 0x0e, 0x0e], //
    0x0f: [0x0f, 0x0f, 0x0f], //

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
    0x1a: [0x1a, 0x1a, 0x1a], //
    0x1b: [0x1b, 0x1b, 0x1b], // ESC
    0x1c: [0x1c, 0x1c, 0x1c], //
    0x1d: [0x1d, 0x1d, 0x1d], //
    0x1e: [0x1e, 0x1e, 0x1e], //
    0x1f: [0x1f, 0x1f, 0x1f], //

    // Most of these besides space won't happen
    0x20: [0x20, 0x20, 0x20], //
    0x21: [0x21, 0x21, 0x21], //
    0x22: [0x22, 0x22, 0x22], //
    0x23: [0x23, 0x23, 0x23], //
    0x24: [0x24, 0x24, 0x24], //
    0x25: [0x08, 0x08, 0x08], // <- left
    0x26: [0x0b, 0x0b, 0x0b], // ^ up
    0x27: [0x15, 0x15, 0x15], // -> right
    0x28: [0x0a, 0x0a, 0x0a], // v down
    0x29: [0x29, 0x29, 0x29], // )
    0x2a: [0x2a, 0x2a, 0x2a], // *
    0x2b: [0x2b, 0x2b, 0x2b], // +
    0x2c: [0x2c, 0x2c, 0x3c], // , - <
    0x2d: [0x2d, 0x2d, 0x5f], // - - _
    0x2e: [0x2e, 0x2e, 0x3e], // . - >
    0x2f: [0x2f, 0x2f, 0x3f], // / - ?

    0x30: [0x30, 0x30, 0x29], // 0 - )
    0x31: [0x31, 0x31, 0x21], // 1 - !
    0x32: [0x32, 0x00, 0x40], // 2 - @
    0x33: [0x33, 0x33, 0x23], // 3 - #
    0x34: [0x34, 0x34, 0x24], // 4 - $
    0x35: [0x35, 0x35, 0x25], // 5 - %
    0x36: [0x36, 0x36, 0x5e], // 6 - ^
    0x37: [0x37, 0x37, 0x26], // 7 - &
    0x38: [0x38, 0x38, 0x2a], // 8 - *
    0x39: [0x39, 0x39, 0x28], // 9 - (
    0x3a: [0x3a, 0x3a, 0x3a], // :
    0x3b: [0x3b, 0x3b, 0x3a], // ; - :
    0x3c: [0x3c, 0x3c, 0x3c], // <
    0x3d: [0x3d, 0x3d, 0x2b], // = - +
    0x3e: [0x3e, 0x3e, 0x3e], // >
    0x3f: [0x3f, 0x3f, 0x3f], // ?

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
    0x4a: [0x6a, 0x0a, 0x4a], // J - NL
    0x4b: [0x6b, 0x0b, 0x4b], // K - VT
    0x4c: [0x6c, 0x0c, 0x4c], // L
    0x4d: [0x6d, 0x0d, 0x4d], // M - CR
    0x4e: [0x6e, 0x0e, 0x4e], // N
    0x4f: [0x6f, 0x0f, 0x4f], // O

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
    0x5a: [0x7a, 0x1a, 0x5a], // Z
    0x5b: [0xff, 0xff, 0xff], // Left window
    0x5c: [0xff, 0xff, 0xff], // Right window
    0x5d: [0xff, 0xff, 0xff], // Select
    0x5e: [0x5e, 0x1e, 0x5e], //
    0x5f: [0x5f, 0x1f, 0x5f], // _

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

    0x6a: [0x2a, 0x2a, 0x2a], // *
    0x6b: [0x2b, 0x2b, 0x2b], // +
    0x6d: [0x2d, 0x2d, 0x2d], // -
    0x6e: [0x2e, 0x2e, 0x2e], // .
    0x6f: [0x2f, 0x2f, 0x39], // /

    // Stray keys
    0xad: [0x2d, 0x2d, 0x5f], // - - _
    0xba: [0x3b, 0x3b, 0x3a], // ; - :
    0xbb: [0x3d, 0x3d, 0x2b], // = - +
    0xbc: [0x2c, 0x2c, 0x3c], // , - <
    0xbd: [0x2d, 0x2d, 0x5f], // - - _
    0xbe: [0x2e, 0x2e, 0x3e], // . - >
    0xbf: [0x2f, 0x2f, 0x3f], // / - ?
    0xc0: [0x60, 0x60, 0x7e], // ` - ~
    0xdb: [0x5b, 0x1b, 0x7b], // [ - {
    0xdc: [0x5c, 0x1c, 0x7c], // \ - |
    0xdd: [0x5d, 0x1d, 0x7d], // ] - }
    0xde: [0x27, 0x22, 0x22], // ' - '

    0xff: [0xff, 0xff, 0xff], // No comma line
} as const;

function isKeyboardCode(code: number): code is KnownKeys<typeof keymap> {
    return code in keymap;
}

const uiKitMap = {
    Dead: 0xff,
    UIKeyInputLeftArrow: 0x08,
    UIKeyInputRightArrow: 0x15,
    UIKeyInputUpArrow: 0x0b,
    UIKeyInputDownArrow: 0x0a,
    UIKeyInputEscape: 0x1b,
} as const;

function isUiKitKey(k: string): k is KnownKeys<typeof uiKitMap> {
    return k in uiKitMap;
}

// prettier-ignore
export const keys2 = [
    [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', ':', '-', 'RESET'],
        ['ESC', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'REPT', 'RETURN'],
        ['CTRL', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', '&larr;', '&rarr;'],
        ['SHIFT', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'SHIFT'],
        ['POWER', '&nbsp;']
    ], [
        ['!', '"', '#', '$', '%', '&', '\'', '(', ')', '0', '*', '=', 'RESET'],
        ['ESC', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', '@', 'REPT', 'RETURN'],
        ['CTRL', 'A', 'S', 'D', 'F', 'BELL', 'H', 'J', 'K', 'L', '+', '&larr;', '&rarr;'],
        ['SHIFT', 'Z', 'X', 'C', 'V', 'B', '^', ']', '<', '>', '?', 'SHIFT'],
        ['POWER', '&nbsp;']
    ]
] as const;

type Key2 = DeepMemberOf<typeof keys2>;

// prettier-ignore
export const keys2e = [
    [
        ['ESC', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'DELETE'],
        ['TAB', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
        ['CTRL', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', '"', 'RETURN'],
        ['SHIFT', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'SHIFT'],
        ['LOCK', '`', 'POW', 'OPEN_APPLE', '&nbsp;', 'CLOSED_APPLE', '&larr;', '&rarr;', '&darr;', '&uarr;']
    ], [
        ['ESC', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', 'DELETE'],
        ['TAB', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '{', '}', '|'],
        ['CTRL', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ':', '\'', 'RETURN'],
        ['SHIFT', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '<', '>', '?', 'SHIFT'],
        ['CAPS', '~', 'POW', 'OPEN_APPLE', '&nbsp;', 'CLOSED_APPLE', '&larr;', '&rarr;', '&darr;', '&uarr;']
    ]
] as const;

type Key2e = DeepMemberOf<typeof keys2e>;

// prettier-ignore
const keyspravetz82 = [
    [
        ['!', '"', '#', '¤', '%', '&', '\'', '(', ')', '0', '*', '=', '﹁', 'RST'],
        ['ОСВ', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '@', 'RPT', 'RETURN'],
        ['МК', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '+', '[', ']', '&darr;'],
        ['ЛАТ', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '<', '>', '?', 'ЛАТ', 'ЛАТ2'],
        ['ВКЛ', '&nbsp;']
    ], [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', ':', '-', 'Ч', 'RST'],
        ['ОСВ', 'Я', 'В', 'Е', 'Р', 'Т', 'Ъ', 'У', 'И', 'О', 'П', 'Ю', 'RPT', 'RETURN'],
        ['МК', 'А', 'С', 'Д', 'Ф', 'Г', 'Х', 'Й', 'К', 'Л', ';', 'Ш', 'Щ', '&darr;'],
        ['ЛАТ', 'З', 'Ь', 'Ц', 'Ж', 'Б', 'Н', 'М', ',', '.', '/', 'ЛАТ', 'ЛАТ2'],
        ['ВКЛ', '&nbsp;']
    ]
] as const;

type KeyPravetz82 = DeepMemberOf<typeof keyspravetz82>;

type Key = Key2 | Key2e | KeyPravetz82;

type KeyFunction = (key: KeyboardEvent) => void;

export default class KeyBoard {
    private kb: HTMLElement;
    private keys;

    private shifted = false;
    private controlled = false;
    private capslocked = true;

    // Initially caps lock on physical keyboard is assumed to be off,
    // but on emulated keyboard it is on.
    private capslockKeyUsed = false;
    private optioned = false;
    private commanded = false;

    private functions: Record<string, KeyFunction> = {};

    constructor(
        private cpu: CPU6502,
        private io: Apple2IO,
        private layout: string
    ) {
        switch (this.layout) {
            case 'apple2e':
                this.keys = keys2e;
                break;
            case 'pravetz82':
                this.keys = keyspravetz82;
                this.capslocked = false; // Pravetz 82 starts with CAPS LOCK off.
                break;
            default:
                this.keys = keys2;
                break;
        }

        window.addEventListener('keydown', this.keydown);
        window.addEventListener('keyup', this.keyup);
    }

    setFunction(key: string, fn: KeyFunction) {
        this.functions[key] = fn;
    }

    mapKeyEvent(evt: KeyboardEvent) {
        const code = evt.keyCode;
        let key: byte = 0xff;

        if (isUiKitKey(evt.key)) {
            key = uiKitMap[evt.key];
        } else if (isKeyboardCode(code)) {
            key = keymap[code][evt.shiftKey ? 2 : evt.ctrlKey ? 1 : 0];

            if (code !== 20 && this.capslockKeyUsed) {
                this.capslockKey(evt.getModifierState('CapsLock'));
            }

            if (this.capslocked && key >= 0x61 && key <= 0x7a) {
                key -= 0x20;
            }
        } else {
            debug('Unhandled key = ' + toHex(code));
        }

        if (key === 0x7f && evt.shiftKey && evt.ctrlKey) {
            this.cpu.reset();
            key = 0xff;
        }

        return key;
    }

    shiftKey(down: boolean) {
        const shiftKeys = this.kb.querySelectorAll(
            this.layout !== 'pravetz82' ? '.key-SHIFT' : '.key-ЛАТ'
        );
        this.shifted = down;
        if (down) {
            this.io.buttonUp(2);
            shiftKeys.forEach((key) => {
                key.classList.add('active');
            });
        } else {
            this.io.buttonDown(2);
            shiftKeys.forEach((key) => {
                key.classList.remove('active');
            });
        }
    }

    controlKey(down: boolean) {
        const ctrlKey = this.kb.querySelector(
            this.layout !== 'pravetz82' ? '.key-CTRL' : '.key-МК'
        );
        this.controlled = down;
        if (down) {
            ctrlKey!.classList.add('active');
        } else {
            ctrlKey!.classList.remove('active');
        }
    }

    commandKey(down: boolean) {
        const commandKey = this.kb.querySelector('.key-OPEN_APPLE');
        if (!commandKey) {
            return;
        }
        this.commanded = down;
        if (down) {
            this.io.buttonDown(0);
            commandKey.classList.add('active');
        } else {
            this.io.buttonUp(0);
            commandKey.classList.remove('active');
        }
    }

    optionKey(down: boolean) {
        const optionKey = this.kb.querySelector('.key-CLOSED_APPLE');
        if (!optionKey) {
            return;
        }
        this.optioned = down;
        if (down) {
            this.io.buttonDown(1);
            optionKey.classList.add('active');
        } else {
            this.io.buttonUp(1);
            optionKey.classList.remove('active');
        }
    }

    /**
     * Sets the state of the Caps Lock key. It is very complicated.
     * @param down if `true`, Caps Lock is pressed; if `false` Caps Lock is not pressed;
     *     if `undefined`, Caps Lock is toggled and its "used" state is set to false;
     *     if called with no arguments, the state is toggled _if_ it has been used before,
     *     otherwise the used state is set to true.
     */
    capslockKey(down?: boolean | undefined) {
        const capsLock = this.kb.querySelector(
            this.layout !== 'pravetz82' ? '.key-LOCK' : '.key-ЛАТ2'
        );

        if (arguments.length === 0) {
            if (this.capslockKeyUsed) {
                this.capslocked = !this.capslocked;
            } else {
                this.capslockKeyUsed = true;
            }
        } else if (down === undefined) {
            this.capslocked = !this.capslocked;
            this.capslockKeyUsed = false;
        } else {
            this.capslocked = down;
        }

        if (this.capslocked) {
            capsLock!.classList.add('active');
        } else {
            capsLock!.classList.remove('active');
        }
    }

    reset(event: Event) {
        event.preventDefault();
        event.stopPropagation();
        this.cpu.reset();
    }

    create(el: string) {
        this.kb = document.querySelector(el)!;
        this.kb.classList.add('layout-' + this.layout);
        let x, y, row, key, label, label1, label2;

        const buildLabel = (k: string) => {
            const span = document.createElement('span');
            span.innerHTML = k;
            if (k.length > 1 && k.slice(0, 1) !== '&')
                span.classList.add('small');
            return span;
        };

        for (y = 0; y < 5; y++) {
            row = document.createElement('div');
            row.classList.add('row');
            row.classList.add(`row${y}`);
            this.kb.append(row);
            for (x = 0; x < this.keys[0][y].length; x++) {
                const key1 = this.keys[0][y][x];
                const key2 = this.keys[1][y][x];

                label = document.createElement('div');
                label1 = buildLabel(key1);
                label2 = buildLabel(key2);

                key = document.createElement('div');
                key.classList.add('key');
                key.classList.add('key-' + key1.replace(/[&#;]/g, ''));

                if (key1.length > 1) {
                    if (key1 === 'LOCK') key.classList.add('v-center2');
                    else key.classList.add('v-center');
                }
                if (key1 !== key2) {
                    key.classList.add('key-' + key2.replace(/[&;]/g, ''));
                    label.append(label2);
                    label.append(document.createElement('br'));
                }
                if (key1 === 'LOCK') {
                    key.classList.add('active');
                }

                label.append(label1);
                key.append(label);
                key.dataset.key1 = key1;
                key.dataset.key2 = key2;

                const mouseDown = this.genMouseDown(key, key1, key2);
                const mouseUp = this.genMouseUp(key);
                if (window.ontouchstart === undefined) {
                    key.addEventListener('mousedown', mouseDown);
                    key.addEventListener('mouseup', mouseUp);
                    key.addEventListener('mouseleave', mouseUp);
                } else {
                    key.addEventListener('touchstart', mouseDown);
                    key.addEventListener('touchend', mouseUp);
                    key.addEventListener('touchleave', mouseUp);
                }

                row.append(key);
            }
        }
    }

    private genMouseDown(target: HTMLElement, key1: Key, key2: Key) {
        return (ev: MouseEvent) => {
            ev.preventDefault();
            target.classList.add('pressed');

            let key: string;
            if (this.layout !== 'pravetz82') {
                key = this.shifted ? key2 : key1;
            } else {
                // In Pravetz 82, the operation of the shift key is inverted.
                //  The top row (cyrillic) is used by default and shift switches to using the bottow row (latin).
                key = this.shifted ? key1 : key2;
            }
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
                    if (this.layout !== 'pravetz82') {
                        key = '\x0A';
                    } else {
                        // On Pravetz 82 this key has no action.
                    }
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

            if (this.layout === 'pravetz82') {
                // Pravetz 82 specific remapping.
                //  Lower-case lattin letters are replaced with cyrillic capital letters.
                switch (key) {
                    // First row.
                    case 'Ч':
                        key = '^';
                        break;
                    case '﹁':
                        // FIXME: Which character should this map to?
                        break;

                    // Second row.
                    case 'ОСВ': // Pravetz 82 ESC key in cyrillic.
                        key = '\x1B';
                        break;
                    case 'Я':
                        key = 'q';
                        break;
                    case 'В':
                        key = 'w';
                        break;
                    case 'Е':
                        key = 'e';
                        break;
                    case 'Р':
                        key = 'r';
                        break;
                    case 'Т':
                        key = 't';
                        break;
                    case 'Ъ':
                        key = 'y';
                        break;
                    case 'У':
                        key = 'u';
                        break;
                    case 'И':
                        key = 'i';
                        break;
                    case 'О':
                        key = 'o';
                        break;
                    case 'П':
                        key = 'p';
                        break;
                    case 'Ю':
                        key = '@';
                        break;
                    case '@':
                        key = '`';
                        break;

                    // Third row.
                    case 'А':
                        key = 'a';
                        break;
                    case 'С':
                        key = 's';
                        break;
                    case 'Д':
                        key = 'd';
                        break;
                    case 'Ф':
                        key = 'f';
                        break;
                    case 'Г':
                        key = 'g';
                        break;
                    case 'Х':
                        key = 'h';
                        break;
                    case 'Й':
                        key = 'j';
                        break;
                    case 'К':
                        key = 'k';
                        break;
                    case 'Л':
                        key = 'l';
                        break;
                    case 'Ш':
                        key = '[';
                        break;
                    case 'Щ':
                        key = ']';
                        break;
                    case '[':
                        key = '{';
                        break;
                    case ']':
                        key = '}';
                        break;

                    // Fourth row.
                    case 'З':
                        key = 'z';
                        break;
                    case 'Ь':
                        key = 'x';
                        break;
                    case 'Ц':
                        key = 'c';
                        break;
                    case 'Ж':
                        key = 'v';
                        break;
                    case 'Б':
                        key = 'b';
                        break;
                    case 'Н':
                        key = 'n';
                        break;
                    case 'М':
                        key = 'm';
                        break;

                    default:
                        break;
                }
            }

            if (key.length > 1) {
                switch (key) {
                    case 'SHIFT':
                    case 'ЛАТ': // Shift on Pravetz 82 switches to cyrillic.
                        this.shiftKey(!this.shifted);
                        break;
                    case 'CTRL':
                    case 'МК': // Pravetz 82 CTRL key in cyrillic.
                        this.controlKey(!this.controlled);
                        break;
                    case 'CAPS':
                    case 'LOCK':
                    case 'ЛАТ2': // CAPS LOCK on Pravetz 82 switches between cyrillic and latin.
                        this.capslockKey(undefined);
                        break;
                    case 'POW':
                    case 'POWER':
                    case 'ВКЛ': // Pravetz 82 power key in cyrillic.
                        if (window.confirm('Power Cycle?'))
                            window.location.reload();
                        break;
                    case 'RESET':
                    case 'RST':
                        this.cpu.reset();
                        break;
                    case 'OPEN_APPLE':
                        this.commandKey(!this.commanded);
                        break;
                    case 'CLOSED_APPLE':
                        this.optionKey(!this.optioned);
                        break;
                    case 'RPT': // Pravetz 82 "repeat" key.
                        // Do nothing.
                        break;
                    default:
                        break;
                }
            } else {
                if (this.controlled && key >= '@' && key <= '_') {
                    this.io.keyDown(key.charCodeAt(0) - 0x40);
                } else if (
                    this.layout === 'apple2e' &&
                    !this.shifted &&
                    !this.capslocked &&
                    key >= 'A' &&
                    key <= 'Z'
                ) {
                    this.io.keyDown(key.charCodeAt(0) + 0x20);
                } else if (
                    this.layout === 'pravetz82' &&
                    !this.shifted &&
                    this.capslocked &&
                    key >= 'a' &&
                    key <= 'z'
                ) {
                    // CAPS LOCK on Pravetz 82 switches between cyrillic and latin.
                    this.io.keyDown(key.charCodeAt(0) - 0x20);
                } else {
                    this.io.keyDown(key.charCodeAt(0));
                }
            }
        };
    }

    private dialogOpen() {
        return !!document.querySelector('.modal.is-open');
    }

    private genMouseUp(target: HTMLElement) {
        return () => target.classList.remove('pressed');
    }

    private keydown = (evt: KeyboardEvent) => {
        if (
            !this.dialogOpen() &&
            (!evt.metaKey || evt.ctrlKey || this.layout === 'apple2e')
        ) {
            evt.preventDefault();

            const key = this.mapKeyEvent(evt);
            if (key !== 0xff) {
                this.io.keyDown(key);
                return;
            }
        }

        if (evt.key === 'Shift') {
            this.shiftKey(true);
        } else if (evt.key === 'CapsLock') {
            this.capslockKey();
        } else if (evt.key === 'Control') {
            this.controlKey(true);
        } else if (evt.key === 'Meta') {
            // AKA Command
            this.commandKey(true);
        } else if (evt.key === 'Alt') {
            if (evt.location === 1) {
                this.commandKey(true);
            } else {
                this.optionKey(true);
            }
        } else {
            if (evt.key in this.functions) {
                this.functions[evt.key](evt);
                evt.preventDefault();
            }
        }
    };

    private keyup = (evt: KeyboardEvent) => {
        if (!this.dialogOpen()) {
            this.io.keyUp();
        }

        if (evt.key === 'Shift') {
            // Shift
            this.shiftKey(false);
        } else if (evt.key === 'Control') {
            // Control
            this.controlKey(false);
        } else if (evt.key === 'Meta') {
            // AKA Command
            this.commandKey(false);
        } else if (evt.key === 'Alt') {
            // Alt
            if (evt.location === 1) {
                this.commandKey(false);
            } else {
                this.optionKey(false);
            }
        }
    };
}
