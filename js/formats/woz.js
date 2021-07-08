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
import { ENCODING_BITSTREAM } from './types';

const WOZ_HEADER_START = 0;
const WOZ_HEADER_SIZE = 12;

const WOZ1_SIGNATURE = 0x315A4F57;
const WOZ2_SIGNATURE = 0x325A4F57;
const WOZ_INTEGRITY_CHECK = 0x0a0d0aff;

function stringFromBytes(data, start, end) {
    return String.fromCharCode.apply(
        null,
        new Uint8Array(data.buffer.slice(data.byteOffset + start, data.byteOffset + end))
    );
}

function grabNibble(bits, offset) {
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
        offset: offset
    };
}

function InfoChunk(data) {
    Object.assign(this, {
        version: data.getUint8(0),
        diskType: data.getUint8(1),
        writeProtected: data.getUint8(2),
        synchronized: data.getUint8(3),
        cleaned: data.getUint8(4),
        creator: stringFromBytes(data, 5, 37)
    });

    if (this.version > 1) {
        Object.assign(this, {
            sides: data.getUint8(37),
            bootSector: data.getUint8(38),
            bitTiming: data.getUint8(39),
            compatibleHardware: data.getUint16(40, true),
            requiredRAM: data.getUint16(42, true),
            largestTrack: data.getUint16(44, true)
        });
    }

    return this;
}

function TMapChunk(data) {
    this.trackMap = [];

    for (let idx = 0; idx < 160; idx++) {
        this.trackMap.push(data.getUint8(idx));
    }

    return this;
}

function TrksChunk(data) {
    const WOZ_TRACK_SIZE = 6656;
    const WOZ_TRACK_INFO_BITS = 6648;

    this.rawTracks = [];
    this.tracks = [];
    for (let trackNo = 0, idx = 0; idx < data.byteLength; idx += WOZ_TRACK_SIZE, trackNo++) {
        let track = [];
        const rawTrack = [];
        const slice = data.buffer.slice(data.byteOffset + idx, data.byteOffset + idx + WOZ_TRACK_SIZE);
        const trackData = new Uint8Array(slice);
        const trackInfo = new DataView(slice);
        const trackBitCount = trackInfo.getUint16(WOZ_TRACK_INFO_BITS, true);
        for (let jdx = 0; jdx < trackBitCount; jdx++) {
            const byteIndex = jdx >> 3;
            const bitIndex = 7 - (jdx & 0x07);
            rawTrack[jdx] = (trackData[byteIndex] >> bitIndex) & 0x1;
        }

        track = [];
        let offset = 0;
        while (offset < rawTrack.length) {
            const result = grabNibble(rawTrack, offset);
            if (!result.nibble) { break; }
            track.push(result.nibble);
            offset = result.offset + 1;
        }

        this.tracks[trackNo] = new Uint8Array(track);
        this.rawTracks[trackNo] = new Uint8Array(rawTrack);
    }

    return this;
}

function TrksChunk2(data) {
    let trackNo;
    this.trks = [];
    for (trackNo = 0; trackNo < 160; trackNo++) {
        const startBlock = data.getUint16(trackNo * 8, true);
        const blockCount = data.getUint16(trackNo * 8 + 2, true);
        const bitCount = data.getUint32(trackNo * 8 + 4, true);
        if (bitCount === 0) { break; }
        this.trks.push({
            startBlock: startBlock,
            blockCount: blockCount,
            bitCount: bitCount
        });
    }
    this.tracks = [];
    this.rawTracks = [];

    const bits = data.buffer;
    for (trackNo = 0; trackNo < this.trks.length; trackNo++) {
        const trk = this.trks[trackNo];

        let track = [];
        const rawTrack = [];
        const start = trk.startBlock * 512;
        const end = start + trk.blockCount * 512;
        const slice = bits.slice(start, end);
        const trackData = new Uint8Array(slice);
        for (let jdx = 0; jdx < trk.bitCount; jdx++) {
            const byteIndex = jdx >> 3;
            const bitIndex = 7 - (jdx & 0x07);
            rawTrack[jdx] = (trackData[byteIndex] >> bitIndex) & 0x1;
        }

        track = [];
        let offset = 0;
        while (offset < rawTrack.length) {
            const result = grabNibble(rawTrack, offset);
            if (!result.nibble) { break; }
            track.push(result.nibble);
            offset = result.offset + 1;
        }

        this.tracks[trackNo] = new Uint8Array(track);
        this.rawTracks[trackNo] = new Uint8Array(rawTrack);
    }

    return this;
}

function MetaChunk(data) {
    const infoStr = stringFromBytes(data, 0, data.byteLength);
    const parts = infoStr.split('\n');
    const info = parts.reduce(function(acc, part) {
        const subParts = part.split('\t');
        acc[subParts[0]] = subParts[1];
        return acc;
    }, {});

    Object.assign(this, info);

    return this;
}

/**
 * Returns a `Disk` object from Woz image data.
 * @param {*} options the disk image and options
 * @returns {import('./format_utils').Disk}
 */
export default function createDiskFromWoz(options) {
    const { rawData } = options;
    const dv = new DataView(rawData, 0);
    let dvOffset = 0;
    const disk = {
        format: 'woz',
        encoding: ENCODING_BITSTREAM,
    };

    let wozVersion;
    const chunks = {};

    function readHeader() {
        const wozSignature = dv.getUint32(WOZ_HEADER_START + 0, true);

        switch (wozSignature) {
            case WOZ1_SIGNATURE:
                wozVersion = 1;
                break;
            case WOZ2_SIGNATURE:
                wozVersion = 2;
                break;
            default:
                return false;
        }

        if (dv.getUint32(WOZ_HEADER_START + 4, true) !== WOZ_INTEGRITY_CHECK) {
            return false;
        }

        return true;
    }

    function readChunk() {
        if (dvOffset >= dv.byteLength) {
            return null;
        }

        const type = dv.getUint32(dvOffset, true);
        const size = dv.getUint32(dvOffset + 4, true);
        const data = new DataView(dv.buffer, dvOffset + 8, size);
        dvOffset += size + 8;

        return {
            type: type,
            size: size,
            data: data
        };
    }

    if (readHeader()) {
        dvOffset = WOZ_HEADER_SIZE;
        let chunk = readChunk();
        while (chunk) {
            switch (chunk.type) {
                case 0x4F464E49: // INFO
                    chunks.info = new InfoChunk(chunk.data);
                    break;
                case 0x50414D54: // TMAP
                    chunks.tmap = new TMapChunk(chunk.data);
                    break;
                case 0x534B5254: // TRKS
                    if (wozVersion === 1) {
                        chunks.trks = new TrksChunk(chunk.data);
                    } else {
                        chunks.trks = new TrksChunk2(chunk.data);
                    }
                    break;
                case 0x4154454D: // META
                    chunks.meta = new MetaChunk(chunk.data);
                    break;
                case 0x54495257: // WRIT
                // Ignore
                    break;
                default:
                    debug('Unsupported chunk', toHex(chunk.type, 8));
            }
            chunk = readChunk();
        }
    } else {
        debug('Invalid woz header');
    }

    debug(chunks);

    disk.trackMap = chunks.tmap?.trackMap || [];
    disk.tracks = chunks.trks?.tracks || [];
    disk.rawTracks = chunks.trks?.rawTracks || [];
    disk.readOnly = true; //chunks.info.writeProtected === 1;
    disk.name = chunks.meta?.title || options.name;

    return disk;
}
