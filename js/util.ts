import { byte, memory, word } from './types';

/*eslint no-console: 0*/

const hex_digits = '0123456789ABCDEF';
const bin_digits = '01';

/** Returns a random byte. */
export function garbage(): byte {
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
    const result = new Uint8Array(size);

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
    return new Uint8Array(ary);
}

/** Returns a new Uint8Array with the concatenated data from the inputs. */
export function concat(...arys: Array<byte[] | Uint8Array>) {
    const result = new Uint8Array(arys.reduce((l, ary) => l + ary.length, 0));
    let offset = 0;
    for (let i = 0; i < arys.length; i++) {
        result.set(arys[i], offset);
        offset += arys[i].length;
    }
    return result;
}

/** Writes to the console. */
export function debug(...args: unknown[]): void {
    console.log(...args);
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
    let result = '';
    for (let idx = 0; idx < n; idx++) {
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
    let result = '';
    for (let idx = 0; idx < 8; idx++) {
        result = bin_digits[v & 0x01] + result;
        v >>= 1;
    }
    return result;
}
