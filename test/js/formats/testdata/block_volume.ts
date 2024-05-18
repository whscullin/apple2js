import { BLOCK_SIZE } from 'js/formats/prodos/constants';

// 800K Floppy size
export const BLOCK_COUNT = 800;

const SIZE = BLOCK_COUNT * BLOCK_SIZE;

const data = new Uint8Array(SIZE);

for (let block = 0; block < BLOCK_COUNT; block++) {
    for (let byte = 0; byte < 512; byte += 2) {
        data[block * BLOCK_SIZE + byte] = block & 0xff;
        data[block * BLOCK_SIZE + byte + 1] = block >> 8;
    }
}

export const BLOCKS = data.buffer;
