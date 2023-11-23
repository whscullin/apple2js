import { bit, byte, memory } from '../types';
import { base64_decode, base64_encode } from '../base64';
import { bytify, debug, toHex } from '../util';
import {
    NibbleDisk,
    ENCODING_NIBBLE,
    JSONDisk,
    isNibbleDiskFormat,
    SupportedSectors,
} from './types';

/**
 * DOS 3.3 Physical sector order (index is physical sector, value is DOS sector).
 */
export const DO = [
    0x0, 0x7, 0xe, 0x6, 0xd, 0x5, 0xc, 0x4, 0xb, 0x3, 0xa, 0x2, 0x9, 0x1, 0x8,
    0xf,
] as const;

/**
 * DOS 3.3 Logical sector order (index is DOS sector, value is physical sector).
 */
export const _DO = [
    0x0, 0xd, 0xb, 0x9, 0x7, 0x5, 0x3, 0x1, 0xe, 0xc, 0xa, 0x8, 0x6, 0x4, 0x2,
    0xf,
] as const;

/**
 * ProDOS Physical sector order (index is physical sector, value is ProDOS sector).
 */
export const PO = [
    0x0, 0x8, 0x1, 0x9, 0x2, 0xa, 0x3, 0xb, 0x4, 0xc, 0x5, 0xd, 0x6, 0xe, 0x7,
    0xf,
] as const;

/**
 * ProDOS Logical sector order (index is ProDOS sector, value is physical sector).
 */
export const _PO = [
    0x0, 0x2, 0x4, 0x6, 0x8, 0xa, 0xc, 0xe, 0x1, 0x3, 0x5, 0x7, 0x9, 0xb, 0xd,
    0xf,
] as const;

/**
 * DOS 13-sector disk physical sector order (index is disk sector, value is
 * physical sector).
 */
export const D13O = [
    0x0, 0xa, 0x7, 0x4, 0x1, 0xb, 0x8, 0x5, 0x2, 0xc, 0x9, 0x6, 0x3,
] as const;

export const _D13O = [
    0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xb, 0xc,
] as const;

const TRANS53 = [
    0xab, 0xad, 0xae, 0xaf, 0xb5, 0xb6, 0xb7, 0xba, 0xbb, 0xbd, 0xbe, 0xbf,
    0xd6, 0xd7, 0xda, 0xdb, 0xdd, 0xde, 0xdf, 0xea, 0xeb, 0xed, 0xee, 0xef,
    0xf5, 0xf6, 0xf7, 0xfa, 0xfb, 0xfd, 0xfe, 0xff,
] as const;

export const DETRANS53 = [
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00, // A0
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x01,
    0x02,
    0x03, // A8
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x04,
    0x05,
    0x06, // B0
    0x00,
    0x00,
    0x07,
    0x08,
    0x00,
    0x09,
    0x0a,
    0x0b, // B8
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00, // C0
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00, // C8
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x0c,
    0x0d, // D0
    0x00,
    0x00,
    0x0e,
    0x0f,
    0x00,
    0x10,
    0x11,
    0x12, // D8
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00, // E0
    0x00,
    0x00,
    0x13,
    0x14,
    0x00,
    0x15,
    0x16,
    0x17, // E8
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x18,
    0x19,
    0x1a, // F0
    0x00,
    0x00,
    0x1b,
    0x1c,
    0x00,
    0x1d,
    0x1e,
    0x1f, // F8
] as const;

const TRANS62 = [
    0x96, 0x97, 0x9a, 0x9b, 0x9d, 0x9e, 0x9f, 0xa6, 0xa7, 0xab, 0xac, 0xad,
    0xae, 0xaf, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb9, 0xba, 0xbb, 0xbc,
    0xbd, 0xbe, 0xbf, 0xcb, 0xcd, 0xce, 0xcf, 0xd3, 0xd6, 0xd7, 0xd9, 0xda,
    0xdb, 0xdc, 0xdd, 0xde, 0xdf, 0xe5, 0xe6, 0xe7, 0xe9, 0xea, 0xeb, 0xec,
    0xed, 0xee, 0xef, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf9, 0xfa, 0xfb,
    0xfc, 0xfd, 0xfe, 0xff,
] as const;

export const DETRANS62 = [
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
    0x00, 0x00, 0x02, 0x03, 0x00, 0x04, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x07, 0x08, 0x00, 0x00, 0x00, 0x09, 0x0a, 0x0b, 0x0c, 0x0d,
    0x00, 0x00, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x00, 0x14, 0x15, 0x16,
    0x17, 0x18, 0x19, 0x1a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x1b, 0x00, 0x1c, 0x1d, 0x1e, 0x00, 0x00, 0x00, 0x1f,
    0x00, 0x00, 0x20, 0x21, 0x00, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x29, 0x2a, 0x2b, 0x00, 0x2c, 0x2d, 0x2e,
    0x2f, 0x30, 0x31, 0x32, 0x00, 0x00, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38,
    0x00, 0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f,
] as const;

/**
 * Converts a byte into its 4x4 encoded representation
 *
 * @param val byte to encode.
 * @returns A two byte array of representing the 4x4 encoding.
 */
export function fourXfour(val: byte): [xx: byte, yy: byte] {
    let xx = val & 0xaa;
    let yy = val & 0x55;

    xx >>= 1;
    xx |= 0xaa;
    yy |= 0xaa;

    return [xx, yy];
}

/**
 * Converts 2 4x4 encoded bytes into a byte value
 *
 * @param xx First encoded byte.
 * @param yy Second encoded byte.
 * @returns The decoded value.
 */
export function defourXfour(xx: byte, yy: byte): byte {
    return ((xx << 1) | 0x01) & yy;
}

/**
 * Converts a raw sector into a nibblized representation to be combined into a
 * nibblized 16 sector track.
 *
 * @param volume volume number
 * @param track track number
 * @param sector sector number
 * @param data sector data
 * @returns a nibblized representation of the sector data
 */
export function explodeSector16(
    volume: byte,
    track: byte,
    sector: byte,
    data: memory
): byte[] {
    let buf = [];
    let gap;

    /*
     * Gap 1/3 (40/0x28 bytes)
     */

    if (sector === 0)
        // Gap 1
        gap = 0x80;
    else {
        // Gap 3
        gap = track === 0 ? 0x28 : 0x26;
    }

    for (let idx = 0; idx < gap; idx++) {
        buf.push(0xff);
    }

    /*
     * Address Field
     */

    const checksum = volume ^ track ^ sector;
    buf = buf.concat([0xd5, 0xaa, 0x96]); // Address Prolog D5 AA 96
    buf = buf.concat(fourXfour(volume));
    buf = buf.concat(fourXfour(track));
    buf = buf.concat(fourXfour(sector));
    buf = buf.concat(fourXfour(checksum));
    buf = buf.concat([0xde, 0xaa, 0xeb]); // Epilog DE AA EB

    /*
     * Gap 2 (5 bytes)
     */

    for (let idx = 0; idx < 0x05; idx++) {
        buf.push(0xff);
    }

    /*
     * Data Field
     */

    buf = buf.concat([0xd5, 0xaa, 0xad]); // Data Prolog D5 AA AD

    const nibbles: byte[] = [];
    const ptr2 = 0;
    const ptr6 = 0x56;

    for (let idx = 0; idx < 0x156; idx++) {
        nibbles[idx] = 0;
    }

    let idx2 = 0x55;
    for (let idx6 = 0x101; idx6 >= 0; idx6--) {
        let val6 = data[idx6 % 0x100];
        let val2: byte = nibbles[ptr2 + idx2];

        val2 = (val2 << 1) | (val6 & 1);
        val6 >>= 1;
        val2 = (val2 << 1) | (val6 & 1);
        val6 >>= 1;

        nibbles[ptr6 + idx6] = val6;
        nibbles[ptr2 + idx2] = val2;

        if (--idx2 < 0) idx2 = 0x55;
    }

    let last = 0;
    for (let idx = 0; idx < 0x156; idx++) {
        const val = nibbles[idx];
        buf.push(TRANS62[last ^ val]);
        last = val;
    }
    buf.push(TRANS62[last]);

    buf = buf.concat([0xde, 0xaa, 0xeb]); // Epilog DE AA EB

    /*
     * Gap 3
     */

    buf.push(0xff);

    return buf;
}

/**
 * Converts a raw sector into a nibblized representation to be combined into
 * a nibblized 13 sector track.
 *
 * @param volume volume number
 * @param track track number
 * @param sector sector number
 * @param data sector data
 * @returns a nibblized representation of the sector data
 */
export function explodeSector13(
    volume: byte,
    track: byte,
    sector: byte,
    data: memory
): byte[] {
    let buf = [];
    let gap;

    /*
     * Gap 1/3 (40/0x28 bytes)
     */

    if (sector === 0)
        // Gap 1
        gap = 0x80;
    else {
        // Gap 3
        gap = track === 0 ? 0x28 : 0x26;
    }

    for (let idx = 0; idx < gap; idx++) {
        buf.push(0xff);
    }

    /*
     * Address Field
     */

    const checksum = volume ^ track ^ sector;
    buf = buf.concat([0xd5, 0xaa, 0xb5]); // Address Prolog D5 AA B5
    buf = buf.concat(fourXfour(volume));
    buf = buf.concat(fourXfour(track));
    buf = buf.concat(fourXfour(sector));
    buf = buf.concat(fourXfour(checksum));
    buf = buf.concat([0xde, 0xaa, 0xeb]); // Epilog DE AA EB

    /*
     * Gap 2 (5 bytes)
     */

    for (let idx = 0; idx < 0x05; idx++) {
        buf.push(0xff);
    }

    /*
     * Data Field
     */

    buf = buf.concat([0xd5, 0xaa, 0xad]); // Data Prolog D5 AA AD

    const nibbles = [];

    let jdx = 0;
    for (let idx = 0x32; idx >= 0; idx--) {
        const a5 = data[jdx] >> 3;
        const a3 = data[jdx] & 0x07;
        jdx++;
        const b5 = data[jdx] >> 3;
        const b3 = data[jdx] & 0x07;
        jdx++;
        const c5 = data[jdx] >> 3;
        const c3 = data[jdx] & 0x07;
        jdx++;
        const d5 = data[jdx] >> 3;
        const d3 = data[jdx] & 0x07;
        jdx++;
        const e5 = data[jdx] >> 3;
        const e3 = data[jdx] & 0x07;
        jdx++;
        nibbles[idx + 0x00] = a5;
        nibbles[idx + 0x33] = b5;
        nibbles[idx + 0x66] = c5;
        nibbles[idx + 0x99] = d5;
        nibbles[idx + 0xcc] = e5;
        nibbles[idx + 0x100] =
            (a3 << 2) | ((d3 & 0x4) >> 1) | ((e3 & 0x4) >> 2);
        nibbles[idx + 0x133] = (b3 << 2) | (d3 & 0x2) | ((e3 & 0x2) >> 1);
        nibbles[idx + 0x166] = (c3 << 2) | ((d3 & 0x1) << 1) | (e3 & 0x1);
    }
    nibbles[0xff] = data[jdx] >> 3;
    nibbles[0x199] = data[jdx] & 0x07;

    let last = 0;
    for (let idx = 0x199; idx >= 0x100; idx--) {
        const val = nibbles[idx];
        buf.push(TRANS53[last ^ val]);
        last = val;
    }
    for (let idx = 0x0; idx < 0x100; idx++) {
        const val = nibbles[idx];
        buf.push(TRANS53[last ^ val]);
        last = val;
    }
    buf.push(TRANS53[last]);

    buf = buf.concat([0xde, 0xaa, 0xeb]); // Epilog DE AA EB

    /*
     * Gap 3
     */

    buf.push(0xff);

    return buf;
}

export interface TrackNibble {
    track: byte;
    sector: byte;
    nibble: byte;
    sectors: SupportedSectors;
}

enum LookingFor {
    START_OF_FIELD_MARKER_FIRST_NIBBLE,
    START_OF_FIELD_MARKER_SECOND_NIBBLE,
    FIELD_TYPE_MARKER,
    ADDRESS_FIELD,
    ADDRESS_FIELD_13,
    DATA_FIELD_6AND2,
    DATA_FIELD_5AND3,
}

export class FindSectorError extends Error {
    constructor(track: byte, sector: byte, e: unknown | Error | string) {
        super(
            `Error finding track ${track} (${toHex(
                track
            )}), sector ${sector} (${toHex(sector)}): ` +
                (e instanceof Error ? `${e.message}` : `${String(e)}`)
        );
    }
}

/**
 * Finds a sector of data from a nibblized disk. The sector given should be the
 * "physical" sector number, meaning the one that appears in the address field.
 * The first sector with the right sector number and data whose checksum matches
 * is returned. This means that for a dual-boot disk (DOS 3.2 and DOS 3.3),
 * whichever sector is found first wins.
 *
 * @param disk Nibble disk
 * @param track track number to read
 * @param sector sector number to read
 * @returns the track, sector, nibble offset, and detected sectors
 */
export function findSector(
    disk: NibbleDisk,
    track: byte,
    sector: byte
): TrackNibble {
    const cur = disk.tracks[track];
    let sectors: SupportedSectors = 16;
    let state = LookingFor.START_OF_FIELD_MARKER_FIRST_NIBBLE;
    let idx = 0;
    let retry = 0;

    function _readNext() {
        const result = cur[idx++];
        if (idx >= cur.length) {
            idx = 0;
            retry++;
        }
        return result;
    }
    function _skipBytes(count: number) {
        idx += count;
        if (idx >= cur.length) {
            idx %= cur.length;
            retry++;
        }
    }
    let t = 0,
        s = 0,
        v = 0,
        checkSum;
    while (retry < 4) {
        let val: byte;
        switch (state) {
            case LookingFor.START_OF_FIELD_MARKER_FIRST_NIBBLE:
                val = _readNext();
                state =
                    val === 0xd5
                        ? LookingFor.START_OF_FIELD_MARKER_SECOND_NIBBLE
                        : LookingFor.START_OF_FIELD_MARKER_FIRST_NIBBLE;
                break;
            case LookingFor.START_OF_FIELD_MARKER_SECOND_NIBBLE:
                val = _readNext();
                state =
                    val === 0xaa
                        ? LookingFor.FIELD_TYPE_MARKER
                        : LookingFor.START_OF_FIELD_MARKER_FIRST_NIBBLE;
                break;
            case LookingFor.FIELD_TYPE_MARKER:
                val = _readNext();
                switch (val) {
                    case 0x96:
                        state = LookingFor.ADDRESS_FIELD;
                        sectors = 16;
                        break;
                    case 0xb5:
                        state = LookingFor.ADDRESS_FIELD;
                        sectors = 13;
                        break;
                    case 0xad:
                        state =
                            sectors === 16
                                ? LookingFor.DATA_FIELD_6AND2
                                : LookingFor.DATA_FIELD_5AND3;
                        break;
                    default:
                        state = LookingFor.START_OF_FIELD_MARKER_FIRST_NIBBLE;
                }
                break;
            case LookingFor.ADDRESS_FIELD:
                v = defourXfour(_readNext(), _readNext()); // Volume
                t = defourXfour(_readNext(), _readNext()); // Track
                s = defourXfour(_readNext(), _readNext()); // Sector
                checkSum = defourXfour(_readNext(), _readNext());
                if (checkSum !== (v ^ t ^ s)) {
                    debug(
                        'Invalid header checksum:',
                        toHex(v),
                        toHex(t),
                        toHex(s),
                        toHex(checkSum)
                    );
                }
                _skipBytes(3); // Skip footer
                state = 0;
                break;
            case LookingFor.DATA_FIELD_6AND2:
                if (s === sector && t === track) {
                    // Save start of data
                    const nibble = idx;

                    // Do checksum on data
                    let last = 0;
                    for (let jdx = 0; jdx < 0x156; jdx++) {
                        last = DETRANS62[_readNext() - 0x80] ^ last;
                    }
                    const checkSum = DETRANS62[_readNext() - 0x80] ^ last;
                    // Validate checksum before returning
                    if (!checkSum) {
                        return { track, sector, nibble, sectors };
                    } else {
                        debug(
                            'Invalid data checksum:',
                            toHex(last),
                            toHex(track),
                            toHex(sector),
                            toHex(checkSum)
                        );
                    }
                    _skipBytes(3); // Skip footer
                } else _skipBytes(0x159); // Skip data, checksum and footer
                state = LookingFor.START_OF_FIELD_MARKER_FIRST_NIBBLE;
                break;
            case LookingFor.DATA_FIELD_5AND3:
                if (s === sector && t === track) {
                    // Save start of data
                    const nibble = idx;

                    // Do checksum on data
                    let last = 0;
                    for (let jdx = 0; jdx < 0x19a; jdx++) {
                        last = DETRANS53[_readNext() - 0xa0] ^ last;
                    }
                    const checkSum = DETRANS53[_readNext() - 0xa0] ^ last;
                    // Validate checksum before returning
                    if (!checkSum) {
                        return { track, sector, nibble, sectors };
                    } else {
                        debug(
                            'Invalid data checksum:',
                            toHex(last),
                            toHex(track),
                            toHex(sector),
                            toHex(checkSum)
                        );
                    }
                    _skipBytes(3); // Skip footer
                } else {
                    _skipBytes(0x19a); // Skip data, checksum and footer
                }
                state = LookingFor.START_OF_FIELD_MARKER_FIRST_NIBBLE;
                break;
            default:
                state = LookingFor.START_OF_FIELD_MARKER_FIRST_NIBBLE;
                break;
        }
    }
    throw new FindSectorError(track, sector, `too many retries (${retry})`);
}

export class InvalidChecksum extends Error {
    constructor(expected: byte, received: byte) {
        super(`Expected: ${toHex(expected)}, received: ${toHex(received)}`);
    }
}

export class ReadSectorError extends Error {
    constructor(track: byte, sector: byte, e: unknown | Error) {
        super(
            `Error reading track ${track} (${toHex(
                track
            )}), sector ${sector} (${toHex(sector)}): ` +
                (e instanceof Error ? `${e.message}` : `${String(e)}`)
        );
    }
}

/**
 * Reads a sector of data from a nibblized disk. The sector given should be the
 * "physical" sector number, meaning the one that appears in the address field.
 * Like `findSector`, the first sector with the right sector number and data
 * whose checksum matches is returned. This means that for a dual-boot disk
 * (DOS 3.2 and DOS 3.3), whichever sector is found first wins.
 *
 * This does not work for WOZ disks.
 *
 * If the given track and sector combination is not found, a `ReadSectorError`
 * will be thrown.
 *
 * @param disk Nibble disk
 * @param track track number to read
 * @param sector sector number to read
 * @returns An array of sector data bytes.
 */
export function readSector(
    disk: NibbleDisk,
    track: byte,
    sector: byte
): Uint8Array {
    const trackNibble = findSector(disk, track, sector);
    const { nibble, sectors } = trackNibble;
    const cur = disk.tracks[track];

    let idx = nibble;
    const _readNext = () => {
        const result = cur[idx++];
        if (idx >= cur.length) {
            idx = 0;
        }
        return result;
    };

    try {
        return sectors === 13
            ? readSector13(_readNext)
            : readSector16(_readNext);
    } catch (e: unknown) {
        throw new ReadSectorError(track, sector, e);
    }
}

function readSector16(_readNext: () => byte): Uint8Array {
    const data = new Uint8Array(256);
    const data2 = [];
    let last: byte = 0;
    let val;

    for (let jdx = 0x55; jdx >= 0; jdx--) {
        val = DETRANS62[_readNext() - 0x80] ^ last;
        data2[jdx] = val;
        last = val;
    }
    for (let jdx = 0; jdx < 0x100; jdx++) {
        val = DETRANS62[_readNext() - 0x80] ^ last;
        data[jdx] = val;
        last = val;
    }
    const checkSum = DETRANS62[_readNext() - 0x80] ^ last;
    if (checkSum) {
        throw new InvalidChecksum(last, checkSum ^ last);
    }
    for (let kdx = 0, jdx = 0x55; kdx < 0x100; kdx++) {
        data[kdx] <<= 1;
        if ((data2[jdx] & 0x01) !== 0) {
            data[kdx] |= 0x01;
        }
        data2[jdx] >>= 1;

        data[kdx] <<= 1;
        if ((data2[jdx] & 0x01) !== 0) {
            data[kdx] |= 0x01;
        }
        data2[jdx] >>= 1;

        if (--jdx < 0) jdx = 0x55;
    }
    return data;
}

function readSector13(_readNext: () => byte) {
    const data = new Uint8Array(256);
    let val: byte;
    let last: byte = 0;

    // special low 3-bits of 0xFF
    val = DETRANS53[_readNext() - 0xa0] ^ last;
    last = val;
    data[0xff] = val & 0b111;

    // expect 0x99 nibbles of packed lower 3-bits in reverse order
    for (let i = 0x98; i >= 0x00; i--) {
        val = DETRANS53[_readNext() - 0xa0] ^ last;
        last = val;
        const off = Math.floor(i / 0x33) + 5 * (0x32 - (i % 0x33));
        const dOff = 3 + 5 * (0x32 - (i % 0x33));
        const eOff = 4 + 5 * (0x32 - (i % 0x33));
        const bit = 2 - Math.floor(i / 0x33);
        data[off] = (val & 0b11100) >> 2;
        data[dOff] ^= ((val & 0b00010) >> 1) << bit;
        data[eOff] ^= (val & 0b1) << bit;
    }

    // expect 0xFE nibbles of upper 5-bits
    for (let i = 0; i < 0xff; i++) {
        val = DETRANS53[_readNext() - 0xa0] ^ last;
        last = val;
        const off = Math.floor(i / 0x33) + 5 * (0x32 - (i % 0x33));
        data[off] ^= val << 3;
    }

    // and the last special nibble for 0xFF
    val = DETRANS53[_readNext() - 0xa0] ^ last;
    last = val;
    data[0xff] ^= val << 3;

    const checkSum = DETRANS53[_readNext() - 0xa0] ^ last;
    if (checkSum) {
        throw new InvalidChecksum(last, checkSum ^ last);
    }
    return data;
}

/**
 * Reads a sector of data from a nibblized disk
 *
 * TODO(flan): Does not work on WOZ disks
 *
 * @param disk Nibble disk
 * @param track track number to read
 * @param sector sector number to read
 * @returns An array of sector data bytes.
 */
export function writeSector(
    disk: NibbleDisk,
    track: byte,
    sector: byte,
    _data: Uint8Array
): boolean {
    const trackNibble = findSector(disk, track, sector);
    if (!trackNibble) {
        return false;
    }

    // Todo

    return true;
}

/**
 * Convert a nibblized disk into a JSON string for storage.
 *
 * @param disk Nibblized disk
 * @param pretty Whether to format the output string
 * @returns A JSON string representing the disk
 */
export function jsonEncode(disk: NibbleDisk, pretty: boolean): string {
    // For 'nib', tracks are encoded as strings. For all other formats,
    // tracks are arrays of sectors which are encoded as strings.
    const data: string[] | string[][] = [];
    let format = 'dsk';
    for (let t = 0; t < disk.tracks.length; t++) {
        data[t] = [];
        if (disk.format === 'nib') {
            format = 'nib';
            data[t] = base64_encode(disk.tracks[t]);
        } else {
            for (let s = 0; s < 0x10; s++) {
                const _sector = disk.format === 'po' ? _PO[s] : _DO[s];
                (data[t] as string[])[s] = base64_encode(
                    readSector(disk, t, _sector)
                );
            }
        }
    }
    return JSON.stringify(
        {
            type: format,
            encoding: 'base64',
            volume: disk.volume,
            data: data,
            readOnly: disk.readOnly,
        },
        undefined,
        pretty ? '    ' : undefined
    );
}

/**
 * Convert a JSON string into a nibblized disk.
 *
 * @param data JSON string representing a disk image, created by [jsonEncode].
 * @returns A nibblized disk
 */

export function jsonDecode(data: string): NibbleDisk {
    const tracks: memory[] = [];
    const json = JSON.parse(data) as JSONDisk;
    const v = json.volume || 254;
    const readOnly = json.readOnly || false;
    for (let t = 0; t < json.data.length; t++) {
        let track: byte[] = [];
        for (let s = 0; s < json.data[t].length; s++) {
            const _s = json.type === 'po' ? PO[s] : DO[s];
            const sector: string = json.data[t][_s] as string;
            const d = base64_decode(sector);
            track = track.concat(explodeSector16(v, t, s, d));
        }
        tracks[t] = bytify(track);
    }
    if (!isNibbleDiskFormat(json.type)) {
        throw new Error(`JSON disks of type ${json.type} are not supported`);
    }
    const disk: NibbleDisk = {
        volume: v,
        format: json.type,
        encoding: ENCODING_NIBBLE,
        metadata: { name: json.name },
        tracks,
        readOnly,
    };

    return disk;
}

/**
 * Debugging method that displays the logical sector ordering of a nibblized disk
 *
 * @param disk
 */

export function analyseDisk(disk: NibbleDisk) {
    for (let track = 0; track < disk.tracks.length; track++) {
        let outStr = `${toHex(track)}: `;
        let val,
            state = 0;
        let idx = 0;
        const cur = disk.tracks[track];

        const _readNext = () => {
            const result = cur[idx++];
            return result;
        };

        const _skipBytes = (count: number) => {
            idx += count;
        };

        let t = 0,
            s = 0,
            v = 0,
            checkSum;
        while (idx < cur.length) {
            switch (state) {
                case 0:
                    val = _readNext();
                    state = val === 0xd5 ? 1 : 0;
                    break;
                case 1:
                    val = _readNext();
                    state = val === 0xaa ? 2 : 0;
                    break;
                case 2:
                    val = _readNext();
                    state = val === 0x96 ? 3 : val === 0xad ? 4 : 0;
                    break;
                case 3: // Address
                    v = defourXfour(_readNext(), _readNext()); // Volume
                    t = defourXfour(_readNext(), _readNext());
                    s = defourXfour(_readNext(), _readNext());
                    checkSum = defourXfour(_readNext(), _readNext());
                    if (checkSum !== (v ^ t ^ s)) {
                        debug(
                            'Invalid header checksum:',
                            toHex(v),
                            toHex(t),
                            toHex(s),
                            toHex(checkSum)
                        );
                    } else {
                        outStr += toHex(s, 1);
                    }
                    _skipBytes(3); // Skip footer
                    state = 0;
                    break;
                case 4: // Valid header
                    _skipBytes(0x159); // Skip data, checksum and footer
                    state = 0;
                    break;
                default:
                    break;
            }
        }
        debug(outStr);
    }
}

/**
 * Debugging utility to convert a bitstream into a nibble. Does not wrap.
 *
 * @param bits Bitstream containing nibbles
 * @param offset Offset into bitstream to start nibblizing
 * @returns nibble, the next nibble in the bitstream,
 *      and offset, the end of that nibble in the bitstream
 */

export function grabNibble(bits: bit[], offset: number) {
    let nibble = 0;
    let waitForOne = true;

    while (offset < bits.length) {
        const bit = bits[offset];
        if (bit) {
            nibble = (nibble << 1) | 0x01;
            waitForOne = false;
        } else {
            if (!waitForOne) {
                nibble = nibble << 1;
            }
        }
        if (nibble & 0x80) {
            // nibble complete return it
            break;
        }
        offset += 1;
    }

    return {
        nibble: nibble,
        offset: offset,
    };
}
