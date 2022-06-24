import { memory } from 'js/types';
import { concat } from 'js/util';

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

function toImage(disk: memory[][]) {
    const tracks: Uint8Array[] = [];
    for (let t = 0; t < disk.length; t++) {
        const track = concat(...disk[t]);
        tracks.push(track);
    }
    return concat(...tracks);
}

export const BYTES_BY_SECTOR_IMAGE = toImage(BYTES_BY_SECTOR);
export const BYTES_BY_TRACK_IMAGE = toImage(BYTES_BY_TRACK);

function randomImage() {
    const result = new Uint8Array(35 * 16 * 256);
    for (let i = 0; i < result.length; i++) {
        result[i] = Math.floor(Math.random() * 256);
    }
    return result;
}

export const RANDOM_IMAGE = randomImage();
