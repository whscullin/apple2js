import { includes, memory } from '../types';
import { base64_decode } from '../base64';
import {
    BitstreamFormat,
    DiskOptions,
    FloppyDisk,
    FloppyFormat,
    JSONDisk,
    NibbleDisk,
    NibbleFormat,
    NIBBLE_FORMATS,
    WozDisk,
} from './types';
import createDiskFrom2MG from './2mg';
import createDiskFromD13 from './d13';
import createDiskFromDOS from './do';
import createDiskFromProDOS from './po';
import createDiskFromWoz from './woz';
import createDiskFromNibble from './nib';

/** Creates a `NibbleDisk` from the given format and options. */
export function createDisk(
    fmt: NibbleFormat,
    options: DiskOptions
): NibbleDisk | null;
/** Creates a `WozDisk` from the given format and options. */
export function createDisk(
    fmt: BitstreamFormat,
    options: DiskOptions
): WozDisk | null;
/** Creates a `FloppyDisk` (either a `NibbleDisk` or a `WozDisk`) from the given format and options. */
export function createDisk(
    fmt: FloppyFormat,
    options: DiskOptions
): FloppyDisk | null;
export function createDisk(
    fmt: FloppyFormat,
    options: DiskOptions
): FloppyDisk | null {
    let disk: FloppyDisk | null = null;

    switch (fmt) {
        case '2mg':
            disk = createDiskFrom2MG(options) as FloppyDisk;
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
            disk = createDiskFromProDOS(options) as FloppyDisk;
            break;
        case 'woz':
            disk = createDiskFromWoz(options);
            break;
    }

    return disk;
}

/** Creates a NibbleDisk from JSON */
export function createDiskFromJsonDisk(disk: JSONDisk): NibbleDisk | null {
    const fmt = disk.type;
    const readOnly = disk.readOnly;
    const name = disk.name;
    const side = disk.disk;

    if (includes(NIBBLE_FORMATS, fmt)) {
        let trackData: memory[][];
        if (disk.encoding === 'base64') {
            trackData = [];
            for (let t = 0; t < disk.data.length; t++) {
                trackData[t] = [];
                if (disk.type === 'nib') {
                    trackData[t][0] = base64_decode(disk.data[t]);
                } else {
                    for (let s = 0; s < disk.data[t].length; s++) {
                        trackData[t][s] = base64_decode(disk.data[t][s]);
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
            side,
            data: trackData,
        } as DiskOptions;

        return createDisk(fmt, options);
    } else {
        return null;
    }
}
