import { NibbleDisk, DiskOptions, ENCODING_NIBBLE } from './types';
import { memory } from '../types';

/**
 * Returns a `Disk` object from raw nibble image data.
 * @param options the disk image and options
 * @returns A nibblized disk
 */
export default function createDiskFromNibble(options: DiskOptions): NibbleDisk {
    const { data, name, side, rawData, volume, readOnly } = options;
    const disk: NibbleDisk = {
        format: 'nib',
        encoding: ENCODING_NIBBLE,
        name,
        side,
        volume: volume || 254,
        readOnly: readOnly || false,
        tracks: []
    };

    for (let t = 0; t < 35; t++) {
        let track: memory;
        if (rawData) {
            const off = t * 0x1a00;
            track = new Uint8Array(rawData.slice(off, off + 0x1a00));
        } else if (data) {
            track = data[t][0];
        } else {
            throw new Error('Requires data or rawData');
        }
        disk.tracks[t] = track;
    }

    return disk;
}
