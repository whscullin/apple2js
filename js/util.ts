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

import { byte, memory, word } from "./types";

/*eslint no-console: 0*/

const hex_digits = '0123456789ABCDEF';
const bin_digits = '01';

/** Returns a random byte. */
function garbage(): byte {
    return (Math.random() * 0x100) & 0xff;
}

export const testables = {
    garbage
};

/**
 * Returns an array or Uint8Array of `size` bytes filled as if the computer
 * was just powered on.
 */
export function allocMem(size: number) {
    let result: number[] | Uint8Array;
    if (window.Uint8Array) {
        result = new Uint8Array(size);
    } else {
        result = new Array(size);
    }
    
    for (let idx = 0; idx < size; idx++) {
        result[idx] = (idx & 0x02) ? 0x00 : 0xff;
    }
    // Borrowed from AppleWin (https://github.com/AppleWin/AppleWin)
    for (let idx = 0; idx < size; idx += 0x200) {
        result[idx + 0x28] = garbage();
        result[idx + 0x29] = garbage();
        result[idx + 0x68] = garbage();
        result[idx + 0x69] = garbage();
    }
    return result;
}

/** Returns an array or Uint8Array of 256 * `pages` bytes. */
export function allocMemPages(pages: number): memory {
    return allocMem(pages << 8);
}

/** Returns a new Uint8Array for the input array. */
export function bytify(ary: number[]): memory {
    let result: number[] | Uint8Array = ary;
    if (window.Uint8Array) {
        result = new Uint8Array(ary);
    }
    return result;
}

/** Writes to the console. */
export function debug(...args: any[]): void;
export function debug() {
    console.log.apply(console, arguments);
}

/**
 * Returns a string of hex digits (all caps).
 * @param v the value to encode
 * @param n the number of nibbles. If `n` is missing, it is guessed from the value
 *     of `v`. If `v` < 256, it is assumed to be 2 nibbles, otherwise 4.
 */
export function toHex(v: byte | word | number, n?: number) {
    if (!n) {
        n = v < 256 ? 2 : 4;
    }
    var result = '';
    for (var idx = 0; idx < n; idx++) {
        result = hex_digits[v & 0x0f] + result;
        v >>= 4;
    }
    return result;
}

/**
 * Returns a string of 8 binary digits.
 * @param v the value to encode
 */
export function toBinary(v: byte) {
    var result = '';
    for (var idx = 0; idx < 8; idx++) {
        result = bin_digits[v & 0x01] + result;
        v >>= 1;
    }
    return result;
}

/**
 * Returns the value of a query parameter or the empty string if it does not
 * exist.
 * @param name the parameter name. Note that `name` must not have any RegExp
 *     meta-characters except '[' and ']' or it will fail.
 */
// From http://www.netlobo.com/url_query_string_javascript.html
export function gup(name: string) {
    name = name.replace(/[[]/, '\\[').replace(/[\]]/, '\\]');
    var regexS = '[\\?&]' + name + '=([^&#]*)';
    var regex = new RegExp(regexS);
    var results = regex.exec(window.location.href);
    if (!results)
        return '';
    else
        return results[1];
}

/** Returns the URL fragment. */
export function hup() {
    var regex = new RegExp('#(.*)');
    var results = regex.exec(window.location.hash);
    if (!results)
        return '';
    else
        return results[1];
}

/** Packs a 32-bit integer into a string in little-endian order. */
export function numToString(num: number) {
    let result = '';
    for (let idx = 0; idx < 4; idx++) {
        result += String.fromCharCode(num & 0xff);
        num >>= 8;
    }
    return result;
}
