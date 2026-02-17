import React from 'react';
import { DeepMemberOf, KnownKeys } from '../../types';

export const SPECIAL_KEY_MAP = {
    Shift: 'SHIFT',
    Enter: 'RETURN',
    CapsLock: 'LOCK',
    Control: 'CTRL',
    Escape: 'ESC',
    Delete: 'RESET',
    Tab: 'TAB',
    Backspace: 'DELETE',
    ArrowUp: '&uarr;',
    ArrowDown: '&darr;',
    ArrowRight: '&rarr;',
    ArrowLeft: '&larr;',
    // UiKit symbols
    UIKeyInputLeftArrow: '&larr;',
    UIKeyInputRightArrow: '&rarr;',
    UIKeyInputUpArrow: '&uarr;',
    UIKeyInputDownArrow: '&darr;',
    UIKeyInputEscape: 'ESC',
} as const;

export const isSpecialKey = (
    k: string
): k is KnownKeys<typeof SPECIAL_KEY_MAP> => {
    return k in SPECIAL_KEY_MAP;
};

export const SPECIAL_KEY_CODE = {
    TAB: 9,
    RETURN: 13,
    ESC: 27,
    ОСВ: 27, // Pravetz 82 ESC key in cyrillic.
    '&uarr;': 11,
    '&darr;': 10,
    '&rarr;': 21,
    '&larr;': 8,
    DELETE: 127,
} as const;

export const hasSpecialKeyCode = (
    k: string
): k is KnownKeys<typeof SPECIAL_KEY_CODE> => {
    return k in SPECIAL_KEY_CODE;
};

/**
 * Keyboard layout for the Apple ][ / ][+
 */
// prettier-ignore
export const keys2 = [
    [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', ':', '-', 'RESET'],
        ['ESC', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'REPT', 'RETURN'],
        ['CTRL', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', '&larr;', '&rarr;'],
        ['SHIFT', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'SHIFT'],
        ['POWER', '&nbsp;'],
    ],
    [
        ['!', '"', '#', '$', '%', '&', "'", '(', ')', '0', '*', '=', 'RESET'],
        ['ESC', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', '@', 'REPT', 'RETURN'],
        ['CTRL', 'A', 'S', 'D', 'F', 'BELL', 'H', 'J', 'K', 'L', '+', '&larr;', '&rarr;'],
        ['SHIFT', 'Z', 'X', 'C', 'V', 'B', '^', ']', '<', '>', '?', 'SHIFT'],
        ['POWER', '&nbsp;'],
    ],
] as const;

export type Key2 = DeepMemberOf<typeof keys2>;

/**
 * Keyboard layout for the Apple //e
 */
// prettier-ignore
export const keys2e = [
    [
        ['ESC', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'DELETE'],
        ['TAB', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
        ['CTRL', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', '"', 'RETURN'],
        ['SHIFT', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'SHIFT'],
        ['LOCK', '`', 'POW', 'OPEN_APPLE', '&nbsp;', 'CLOSED_APPLE', '&larr;', '&rarr;', '&darr;', '&uarr;'],
    ],
    [
        ['ESC', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', 'DELETE'],
        ['TAB', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '{', '}', '|'],
        ['CTRL', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ':', "'", 'RETURN'],
        ['SHIFT', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '<', '>', '?', 'SHIFT'],
        ['CAPS', '~', 'POW', 'OPEN_APPLE', '&nbsp;', 'CLOSED_APPLE', '&larr;', '&rarr;', '&darr;', '&uarr;'],
    ],
] as const;

/**
 * Keyboaord for the Pravetz 82, a Bulgarian Apple II clone
 */
// prettier-ignore
export const keyspravetz82 = [
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

const SHIFTED2: Record<string, string> = {
    '!': '1',
    '"': '2',
    '#': '3',
    $: '4',
    '%': '5',
    '&': '6',
    "'": '7',
    '(': '8',
    ')': '9',
    '*': ':',
    '=': '-',
    '@': 'P',
    '+': ';',
    '^': 'N',
    ']': 'M',
    '<': ',',
    '>': '.',
    '?': '/',
} as const;

/** Shifted */
const SHIFTED2E: Record<string, string> = {
    '!': '1',
    '@': '2',
    '#': '3',
    $: '4',
    '%': '5',
    '^': '6',
    '&': '7',
    '*': '8',
    '(': '9',
    ')': '0',
    _: '-',
    '+': '=',
    '{': '[',
    '}': ']',
    '|': '\\',
    ':': ';',
    "'": '"',
    '<': ',',
    '>': '.',
    '?': '/',
    '~': '`',
} as const;

const SHIFTED_PRAVETZ: Record<string, string> = {
    // Pravetz 82 specific shifted keys.
    Ч: '^',
    '﹁': '', // FIXME: Which character should this map to?
    // Second row.
    Я: 'q',
    В: 'w',
    Е: 'e',
    Р: 'r',
    Т: 't',
    Ъ: 'y',
    У: 'u',
    И: 'i',
    О: 'o',
    П: 'p',
    Ю: '@',
    '@': '`',
    // Third row.
    А: 'a',
    С: 's',
    Д: 'd',
    Ф: 'f',
    Г: 'g',
    Х: 'h',
    Й: 'j',
    К: 'k',
    Л: 'l',
    Ш: '[',
    Щ: ']',
    '[': '{',
    ']': '}',
    // Fourth row.
    З: 'z',
    Ь: 'x',
    Ц: 'c',
    Ж: 'v',
    Б: 'b',
    Н: 'n',
    М: 'm',
} as const;

const shiftedKeys = {
    apple2e: SHIFTED2E,
    apple2: SHIFTED2,
    pravetz82: SHIFTED_PRAVETZ,
} as const;

export const isShiftyKey = (
    k: string,
    keyboard: 'apple2' | 'apple2e' | 'pravetz82'
): k is KnownKeys<typeof SHIFTED2E> => {
    return k in shiftedKeys[keyboard];
};

export type Key2e = DeepMemberOf<typeof keys2e>;

export type Key = Key2 | Key2e;

export type KeyFunction = (key: KeyboardEvent) => void;

/**
 * Convert a DOM keyboard event into an ASCII equivalent that
 * an Apple II can recognize.
 *
 * @param evt Event to convert
 * @param caps Caps Lock state
 * @returns a tuple of:
 *     * `key`: the symbol of the key
 *     * `keyLabel`: the label on the keycap
 *     * `keyCode`: the corresponding byte for the Apple II
 */
export const mapKeyboardEvent = (
    event: KeyboardEvent,
    layout: 'apple2' | 'apple2e' | 'pravetz82',
    caps: boolean = false,
    control: boolean = false
) => {
    let key: string;
    if (isSpecialKey(event.key)) {
        key = SPECIAL_KEY_MAP[event.key];
    } else if (event.key === 'Alt') {
        key = event.location === 1 ? 'OPEN_APPLE' : 'CLOSED_APPLE';
    } else {
        key = event.key;
    }

    let keyLabel = key;
    if (key.length === 1) {
        if (isShiftyKey(key, layout)) {
            keyLabel = shiftedKeys[layout][key];
        } else {
            keyLabel = key.toUpperCase();
        }
    }

    let keyCode = 0xff;
    if (hasSpecialKeyCode(key)) {
        keyCode = SPECIAL_KEY_CODE[key];
    } else if (key.length === 1) {
        keyCode = key.charCodeAt(0);
    }
    if ((caps || control) && keyCode >= 0x61 && keyCode <= 0x7a) {
        keyCode -= 0x20;
    }
    if (control && keyCode >= 0x40 && keyCode < 0x60) {
        keyCode -= 0x40;
    }

    return { key, keyLabel, keyCode };
};

/**
 * Convert a mouse event into an ASCII character based on the
 * data attached to the target DOM element.
 *
 * @param event Event to convert
 * @param shifted Shift key state
 * @param controlled Control key state
 * @param caps Caps Lock state
 * @param e //e status
 * @returns ASCII character
 */
const MOUSE_EVENT_KEY_MAP = {
    BELL: 'G',
    RETURN: '\r',
    TAB: '\t',
    DELETE: '\x7F',
    '&larr;': '\x08',
    '&rarr;': '\x15',
    '&darr;': '\x0A',
    '&uarr;': '\x0B',
    '&nbsp;': ' ',
    ESC: '\x1B',
    ОСВ: '\x1B', // Pravetz 82 ESC key in cyrillic.
} as const;

export const mapMouseEvent = (
    event: React.MouseEvent<HTMLElement>,
    layout: 'apple2' | 'apple2e' | 'pravetz82',
    shifted: boolean,
    controlled: boolean,
    caps: boolean
) => {
    const keyLabel = event.currentTarget?.dataset.key1 ?? '';
    let key = event.currentTarget?.dataset[shifted ? 'key2' : 'key1'] ?? '';
    let keyCode = 0xff;

    if (key in MOUSE_EVENT_KEY_MAP) {
        key = MOUSE_EVENT_KEY_MAP[key as keyof typeof MOUSE_EVENT_KEY_MAP];
    }

    if (key in SHIFTED_PRAVETZ) {
        key = SHIFTED_PRAVETZ[key];
    }

    if (key.length === 1) {
        if (controlled && key >= '@' && key <= '_') {
            keyCode = key.charCodeAt(0) - 0x40;
        } else if (
            layout === 'apple2e' &&
            !shifted &&
            !caps &&
            key >= 'A' &&
            key <= 'Z'
        ) {
            keyCode = key.charCodeAt(0) + 0x20;
        } else {
            keyCode = key.charCodeAt(0);
        }
    }
    return { keyCode, key, keyLabel };
};

/**
 * Remap keys so that upper and lower are a tuple per row instead of
 * separate rows
 *
 * @param inKeys keys2 or keys2e
 * @returns Keys remapped
 */
export const keysAsTuples = (
    inKeys: typeof keys2e | typeof keys2 | typeof keyspravetz82
): string[][][] => {
    const rows = [];
    for (let idx = 0; idx < inKeys[0].length; idx++) {
        const upper = inKeys[0][idx];
        const lower = inKeys[1][idx];
        const keys = [];
        for (let jdx = 0; jdx < upper.length; jdx++) {
            keys.push([upper[jdx], lower[jdx]]);
        }
        rows.push(keys);
    }
    return rows;
};
