import {
    numberToBytes,
    stringToBytes,
} from '../util';

/**
 * Version 1 INFO segment
 */

const mockInfo1 = [
    0x01, // Version
    0x01, // Disk Type (5.25")
    0x00, // Write protected
    0x01, // Synchronized
    0x00, // Cleaned
    ...stringToBytes('Apple2JS', ' ', 32),
    0x00, 0x00, 0x00, 0x00, // 23 Unused
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00,
];

/**
 * Version 2 INFO segment
 */

const mockInfo2 = [
    0x02, // Version
    0x01, // Disk Type (5.25")
    0x00, // Write protected
    0x01, // Synchronized
    0x00, // Cleaned
    ...stringToBytes('Apple2JS', ' ', 32),
    0x01, // sides
    0x00, // bootSector
    0x00, // bitTiming
    0x00, 0x00, // compatibleHardware
    0x00, 0x00, // requiredRAM
    0x00, 0x00, // largest track
    0x00, 0x00, 0x00, 0x00, // 14 unused
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00,
];

/**
 * Track map all pointing to track 0
 */

export const mockTMAP = new Array(160);
mockTMAP.fill(0);

/**
 * One very small track
 */

// 24 bits of track data, padded

const mockTrackData = new Array(6646);
mockTrackData.fill(0);
mockTrackData[0] = 0xd5;
mockTrackData[1] = 0xaa;
mockTrackData[2] = 0x96;

/**
 * Version 1 TRKS structure
 */

const mockTRKS = [
    ...mockTrackData,
    ...numberToBytes(3, 2), // Number of bytes
    ...numberToBytes(24, 2), // Number of bits
    ...numberToBytes(0xffff, 2), // Splice point
    0, // Splice nibble
    0, // Splice bit count
    ...numberToBytes(0, 2), // Reserved
];

/**
 * Version 2 TRKS structure
 */

const mockTrackMap = new Array(160 * 8);
mockTrackMap.fill(0);
mockTrackMap[0x00] = 0x03;
mockTrackMap[0x01] = 0x00;
mockTrackMap[0x02] = 0x01;
mockTrackMap[0x03] = 0x00;
mockTrackMap[0x04] = 0x18;
mockTrackMap[0x07] = 0x00;
mockTrackMap[0x08] = 0x00;
mockTrackMap[0x09] = 0x00;

const mockTrackData2 = new Array(512);
mockTrackData2.fill(0);
mockTrackData2[0] = 0xd5;
mockTrackData2[1] = 0xaa;
mockTrackData2[2] = 0x96;

const mockTRKS2 = [
    ...mockTrackMap,
    ...mockTrackData2,
];

/**
 * META structures
 */

const mockMETA1 = 'title\tMock Woz 1\t';
const mockMETA2 = 'title\tMock Woz 2\nside_name\tB';

/**
 * Woz Version 1
 */

export const mockWoz1: ArrayBuffer = new Uint8Array([
    // Header
    ...stringToBytes('WOZ1'),
    0xff,                     // 7 bit detection
    0x0a, 0x0d, 0x0a,         // LF detection
    0x00, 0x00, 0x00, 0x00,   // CRC
    // Info chunk
    ...stringToBytes('INFO'),
    ...numberToBytes(60, 4),     // Size
    ...mockInfo1,
    // TMAP chunk
    ...stringToBytes('TMAP'),
    ...numberToBytes(mockTMAP.length, 4), // Size
    ...mockTMAP,
    // TRKS chunk
    ...stringToBytes('TRKS'),
    ...numberToBytes(mockTRKS.length, 4), // Size
    ...mockTRKS,
    // META chunk
    ...stringToBytes('META'),
    ...numberToBytes(mockMETA1.length, 4), // Size
    ...stringToBytes(mockMETA1),
]).buffer;

/**
 * Woz Version 2
 */

export const mockWoz2: ArrayBuffer = new Uint8Array([
    // Header
    ...stringToBytes('WOZ2'),
    0xff,                     // 7 bit detection
    0x0a, 0x0d, 0x0a,         // LF detection
    0x00, 0x00, 0x00, 0x00,   // CRC

    // Info chunk
    ...stringToBytes('INFO'),
    ...numberToBytes(mockInfo2.length, 4),     // Size
    ...mockInfo2,
    // TMAP chunk
    ...stringToBytes('TMAP'),
    ...numberToBytes(mockTMAP.length, 4), // Size
    ...mockTMAP,
    // TRKS chunk
    ...stringToBytes('TRKS'),
    ...numberToBytes(mockTRKS2.length, 4), // Size
    ...mockTRKS2,
    // META chunk
    ...stringToBytes('META'),
    ...numberToBytes(mockMETA2.length, 4), // Size
    ...stringToBytes(mockMETA2),
]).buffer;
