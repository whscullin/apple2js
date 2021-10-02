import { base64_encode } from 'js/base64';
import { JSONDisk } from 'js/formats/types';

export const testDisk: JSONDisk = {
    name: 'Test Disk',
    disk: 'Front',
    category: 'Test',
    type: 'dsk',
    encoding: 'base64',
    data: []
};

const sector = new Uint8Array(256);
sector.fill(0);

for (let idx = 0; idx < 35; idx++) {
    const track: string[] = [];
    for (let jdx = 0; jdx < 16; jdx++) {
        track.push(base64_encode(sector));
    }
    testDisk.data.push(track);
}
