import { debug, toHex } from '../util';
import { bit, byte, word } from '../types';
import { grabNibble } from './format_utils';
import { DiskOptions, ENCODING_BITSTREAM, WozDisk } from './types';

const WOZ_HEADER_START = 0;
const WOZ_HEADER_SIZE = 12;

const WOZ1_SIGNATURE = 0x315A4F57;
const WOZ2_SIGNATURE = 0x325A4F57;
const WOZ_INTEGRITY_CHECK = 0x0a0d0aff;

/**
 * Converts a range of bytes from a DataView into an ASCII string
 *
 * @param data DataView containing string
 * @param start start index of string
 * @param end end index of string
 * @returns ASCII string
 */
function stringFromBytes(data: DataView, start: number, end: number): string {
    return String.fromCharCode.apply(
        null,
        new Uint8Array(data.buffer.slice(data.byteOffset + start, data.byteOffset + end))
    );
}

export class InfoChunk {
    version: byte;

    // Version 1
    diskType: byte;
    writeProtected: byte;
    synchronized: byte;
    cleaned: byte;
    creator: string;

    // Version 2
    sides: byte = 0;
    bootSector: byte = 0;
    bitTiming: byte = 0;
    compatibleHardware: word = 0;
    requiredRAM: word = 0;
    largestTrack: word = 0;

    constructor(data: DataView) {
        this.version = data.getUint8(0);
        this.diskType = data.getUint8(1);
        this.writeProtected = data.getUint8(2);
        this.synchronized = data.getUint8(3);
        this.cleaned = data.getUint8(4);
        this.creator = stringFromBytes(data, 5, 37);

        if (this.version > 1) {
            this.sides = data.getUint8(37);
            this.bootSector = data.getUint8(38);
            this.bitTiming = data.getUint8(39);
            this.compatibleHardware = data.getUint16(40, true);
            this.requiredRAM = data.getUint16(42, true);
            this.largestTrack = data.getUint16(44, true);
        }
    }
}

export class TMapChunk {
    trackMap: byte[];

    constructor(data: DataView) {
        this.trackMap = [];

        for (let idx = 0; idx < 160; idx++) {
            this.trackMap.push(data.getUint8(idx));
        }
    }
}

const WOZ_TRACK_SIZE = 6656;
const WOZ_TRACK_INFO_BITS = 6648;

export class TrksChunk {
    rawTracks: Uint8Array[];
    tracks: Uint8Array[];
}

export class TrksChunk1 extends TrksChunk {
    constructor(data: DataView) {
        super();

        this.rawTracks = [];
        this.tracks = [];

        for (let trackNo = 0, idx = 0; idx < data.byteLength; idx += WOZ_TRACK_SIZE, trackNo++) {
            let track = [];
            const rawTrack: bit[] = [];
            const slice = data.buffer.slice(data.byteOffset + idx, data.byteOffset + idx + WOZ_TRACK_SIZE);
            const trackData = new Uint8Array(slice);
            const trackInfo = new DataView(slice);
            const trackBitCount = trackInfo.getUint16(WOZ_TRACK_INFO_BITS, true);
            for (let jdx = 0; jdx < trackBitCount; jdx++) {
                const byteIndex = jdx >> 3;
                const bitIndex = 7 - (jdx & 0x07);
                rawTrack[jdx] = (trackData[byteIndex] >> bitIndex) & 0x01 ? 1 : 0;
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
    }
}

export interface Trk {
    startBlock: word
    blockCount: word
    bitCount: number
}

export class TrksChunk2 extends TrksChunk {
    trks: Trk[];

    constructor (data: DataView) {
        super();

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
            const rawTrack: bit[] = [];
            const start = trk.startBlock * 512;
            const end = start + trk.blockCount * 512;
            const slice = bits.slice(start, end);
            const trackData = new Uint8Array(slice);
            for (let jdx = 0; jdx < trk.bitCount; jdx++) {
                const byteIndex = jdx >> 3;
                const bitIndex = 7 - (jdx & 0x07);
                rawTrack[jdx] = (trackData[byteIndex] >> bitIndex) & 0x01 ? 1 : 0;
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
    }
}

export class MetaChunk  {
    values: Record<string, string>;

    constructor (data: DataView) {
        const infoStr = stringFromBytes(data, 0, data.byteLength);
        const parts = infoStr.split('\n');
        this.values = parts.reduce(function(acc: Record<string, string>, part) {
            const subParts = part.split('\t');
            acc[subParts[0]] = subParts[1];
            return acc;
        }, {});
    }
}

interface Chunks {
    [key: string]: any
    info?: InfoChunk
    tmap?: TMapChunk
    trks?: TrksChunk
    meta?: MetaChunk
}

/**
 * Returns a `Disk` object from Woz image data.
 * @param options the disk image and options
 * @returns A bitstream disk
 */
export default function createDiskFromWoz(options: DiskOptions): WozDisk {
    const { rawData } = options;
    if (!rawData) {
        throw new Error('Requires rawData');
    }
    const dv = new DataView(rawData, 0);
    let dvOffset = 0;
    let wozVersion;
    const chunks: Chunks = {};

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
                        chunks.trks = new TrksChunk1(chunk.data);
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

    const { meta, tmap, trks } = chunks;

    const disk: WozDisk = {
        encoding: ENCODING_BITSTREAM,
        trackMap: tmap?.trackMap || [],
        tracks: trks?.tracks || [],
        rawTracks: trks?.rawTracks || [],
        readOnly: true, //chunks.info.writeProtected === 1;
        name: meta?.values['title'] || options.name,
        side: meta?.values['side_name'] || meta?.values['side'],
    };

    return disk;
}
