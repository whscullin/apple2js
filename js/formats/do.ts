import { explodeSector16, DO } from './format_utils';
import { bytify } from '../util';
import { byte } from '../types';
import { NibbleDisk, DiskOptions, ENCODING_NIBBLE } from './types';

/**
 * Returns a `Disk` object from DOS-ordered image data.
 * @param options the disk image and options
 * @returns A nibblized disk
 */
export default function createDiskFromDOS(options: DiskOptions): NibbleDisk {
    const { data, name, side, rawData, volume, readOnly } = options;
    const disk: NibbleDisk = {
        format: 'dsk',
        encoding: ENCODING_NIBBLE,
        name,
        side,
        volume,
        readOnly,
        tracks: [],
    };

    for (let t = 0; t < 35; t++) {
        let track: byte[] = [];
        for (let physical_sector = 0; physical_sector < 16; physical_sector++) {
            const dos_sector = DO[physical_sector];
            let sector: Uint8Array;
            if (rawData) {
                const off = (16 * t + dos_sector) * 256;
                sector = new Uint8Array(rawData.slice(off, off + 256));
            } else if (data) {
                sector = new Uint8Array(data[t][dos_sector]);
            } else {
                throw new Error('Requires data or rawData');
            }
            track = track.concat(
                explodeSector16(volume, t, physical_sector, sector)
            );
        }
        disk.tracks[t] = bytify(track);
    }
    return disk;
}
