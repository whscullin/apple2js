import { byte } from '../../../../js/types';

function generateBytesInOrder() {
    const data: byte[][][] = [];
    for (let t = 0; t < 35; t++) {
        const track: byte[][] = [];
        for (let s = 0; s < 13; s++) {
            const sector: byte[] = [];
            for (let b = 0; b < 256; b++) {
                sector[b] = b;
            }
            track[s] = sector;
        }
        data[t] = track;
    }
    return data;
}

export const BYTES_IN_ORDER: byte[][][] = generateBytesInOrder();

function generateBytesBySector() {
    const data: byte[][][] = [];
    for (let t = 0; t < 35; t++) {
        const track: byte[][] = [];
        for (let s = 0; s < 13; s++) {
            const sector: byte[] = [];
            for (let b = 0; b < 256; b++) {
                sector[b] = s;
            }
            track[s] = sector;
        }
        data[t] = track;
    }
    return data;
}

export const BYTES_BY_SECTOR: byte[][][] = generateBytesBySector();

function generateBytesByTrack() {
    const data: byte[][][] = [];
    for (let t = 0; t < 35; t++) {
        const track: byte[][] = [];
        for (let s = 0; s < 13; s++) {
            const sector: byte[] = [];
            for (let b = 0; b < 256; b++) {
                sector[b] = t;
            }
            track[s] = sector;
        }
        data[t] = track;
    }
    return data;
}

export const BYTES_BY_TRACK: byte[][][] = generateBytesByTrack();
