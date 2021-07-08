import { memory } from 'js/types';

function generateBytesInOrder() {
    const data: memory[][] = [];
    for (let t = 0; t < 35; t++) {
        const track: memory[] = [];
        for (let s = 0; s < 16; s++) {
            const sector = new Uint8Array(256);
            for (let b = 0; b < 256; b++) {
                sector[b] = b;
            }
            track[s] = sector;
        }
        data[t] = track;
    }
    return data;
}

export const BYTES_IN_ORDER: memory[][] = generateBytesInOrder();

function generateBytesBySector() {
    const data: memory[][] = [];
    for (let t = 0; t < 35; t++) {
        const track: memory[] = [];
        for (let s = 0; s < 16; s++) {
            const sector = new Uint8Array(256);
            for (let b = 0; b < 256; b++) {
                sector[b] = s;
            }
            track[s] = sector;
        }
        data[t] = track;
    }
    return data;
}

export const BYTES_BY_SECTOR: memory[][] = generateBytesBySector();

function generateBytesByTrack() {
    const data: memory[][] = [];
    for (let t = 0; t < 35; t++) {
        const track: memory[] = [];
        for (let s = 0; s < 16; s++) {
            const sector = new Uint8Array(256);
            for (let b = 0; b < 256; b++) {
                sector[b] = t;
            }
            track[s] = sector;
        }
        data[t] = track;
    }
    return data;
}

export const BYTES_BY_TRACK: memory[][] = generateBytesByTrack();
