import { includes, memory } from '../types';
import { base64_decode } from '../base64';
import { Disk, NibbleFormat, DiskOptions, JSONDisk, NIBBLE_FORMATS } from './types';
import createDiskFrom2MG from './2mg';
import createDiskFromD13 from './d13';
import createDiskFromDOS from './do';
import createDiskFromProDOS from './po';
import createDiskFromWoz from './woz';
import createDiskFromNibble from './nib';

export function createDisk(fmt: NibbleFormat, options: DiskOptions) {
    let disk: Disk | null = null;

    switch (fmt) {
        case '2mg':
            disk = createDiskFrom2MG(options) as Disk;
            break;
        case 'd13':
            disk = createDiskFromD13(options);
            break;
        case 'do':
        case 'dsk':
            disk = createDiskFromDOS(options);
            break;
        case 'nib':
            disk = createDiskFromNibble(options);
            break;
        case 'po':
            disk = createDiskFromProDOS(options);
            break;
        case 'woz':
            disk = createDiskFromWoz(options);
            break;
    }

    return disk;
}

export function createDiskFromJsonDisk(disk: JSONDisk): Disk | null {
    const fmt = disk.type;
    const readOnly = disk.readOnly;
    const name = disk.name;

    if (includes(NIBBLE_FORMATS, fmt)) {
        let trackData: memory[][];
        if (disk.encoding == 'base64') {
            trackData = [];
            for (let t = 0; t < disk.data.length; t++) {
                trackData[t] = [];
                if (fmt == 'nib') {
                    trackData[t][0] = base64_decode(disk.data[t] as string);
                } else {
                    for (let s = 0; s < disk.data[t].length; s++) {
                        trackData[t][s] = base64_decode(disk.data[t][s] as string);
                    }
                }
            }
        } else {
            trackData = disk.data;
        }

        const volume = disk.volume || 0xfe;

        const options = {
            volume,
            readOnly,
            name,
            data: trackData
        } as DiskOptions;

        return createDisk(fmt, options);
    } else {
        return null;
    }
}

