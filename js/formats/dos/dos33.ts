import { byte, word } from 'js/types';
import { debug, toHex } from 'js/util';
import ApplesoftDump from 'js/applesoft/decompiler';
import IntegerBASICDump from 'js/intbasic/decompiler';
import { MassStorageData, NibbleDisk } from '../types';
import { readSector, writeSector } from '../format_utils';

/** Usual track for VTOC */
export const DEFAULT_VTOC_TRACK = 0x11;

/** Usual sector for VTOC */
export const DEFAULT_VTOC_SECTOR = 0x00;

/** Usual track, sector for VTOC */
export const DEFAULT_VTOC_TRACK_SECTOR = {
    track: DEFAULT_VTOC_TRACK,
    sector: DEFAULT_VTOC_SECTOR,
} as const;

/**
 * VTOC sector offsets
 */
export const VTOC_OFFSETS = {
    CATALOG_TRACK: 0x01,
    CATALOG_SECTOR: 0x02,
    VERSION: 0x03,
    VOLUME: 0x06,
    TRACK_SECTOR_LIST_SIZE: 0x27,
    LAST_ALLOCATION_TRACK: 0x30,
    ALLOCATION_DIRECTION: 0x31,
    TRACK_COUNT: 0x34,
    SECTOR_COUNT: 0x35,
    SECTOR_BYTE_COUNT_LOW: 0x36,
    SECTOR_BYTE_COUNT_HIGH: 0x37,
    FREE_SECTOR_MAP: 0x38,
} as const;

/**
 * Catalog sector offsets
 */
export const CATALOG_OFFSETS = {
    NEXT_CATALOG_TRACK: 0x01,
    NEXT_CATALOG_SECTOR: 0x02,
    ENTRY1: 0x0B,
    ENTRY2: 0x2E,
    ENTRY3: 0x51,
    ENTRY4: 0x74,
    ENTRY5: 0x97,
    ENTRY6: 0xBA,
    ENTRY7: 0xDD,
} as const;

/**
 * Catalog entry offsets
 */
export const CATALOG_ENTRY_OFFSETS = {
    SECTOR_LIST_TRACK: 0x00,
    SECTOR_LIST_SECTOR: 0x01,
    FILE_TYPE: 0x02,
    FILE_NAME: 0x03,
    FILE_LENGTH_LOW: 0x21,
    FILE_LENGTH_HIGH: 0x22,
} as const;

export const CATALOG_ENTRY_LENGTH = 0x23;

/**
 * VTOC Data
 */
export interface VTOC {
    catalog: {
        track: byte;
        sector: byte;
    };
    version: byte;
    volume: byte;
    trackSectorListSize: byte;
    lastAllocationTrack: byte;
    allocationDirection: byte;
    trackCount: byte;
    sectorCount: byte;
    sectorByteCount: byte;
    trackSectorMap: boolean[][];
}

/**
 * Track and sector data
 */
export interface TrackSector {
    track: byte;
    sector: byte;
}

/**
 * File entry data
 */
export interface FileEntry {
    locked: boolean;
    deleted: boolean;
    type: string;
    size: number;
    name: string;
    trackSectorList: TrackSector;
}

/**
 * File data
 */
export interface FileData {
    address: word;
    data: Uint8Array;
}

function isNibbleDisk(disk: NibbleDisk | MassStorageData): disk is NibbleDisk {
    return !!((disk as NibbleDisk).encoding);
}

/**
 * DOS 3.3 Volume object.
 */
export class DOS33 {
    private vtoc: VTOC;
    private files: FileEntry[];

    /**
     * Constructor can take either a nibblized disk, or a raw data
     * object returned by MassStorage.getBinary()
     *
     * @param disk Nibble disk or MassStorageData object
     */
    constructor(private disk: NibbleDisk | MassStorageData) {
        this.vtoc = this.readVolumeTOC();
    }

    /**
     * Method to read or write a sector, could be overloaded to support other
     * data types.
     *
     * @param track Track to read/write
     * @param sector Sector to read/write
     * @param data If present, sector data to write
     *
     * @returns data read or written
     */
    rwts(track: byte, sector: byte, data?: Uint8Array): Uint8Array {
        if (data) {
            if (isNibbleDisk(this.disk)) {
                writeSector(this.disk, track, sector, data);
            } else {
                const offset = track * 0x1000 + sector * 0x100;
                new Uint8Array(this.disk.data).set(data, offset);
            }
        } else {
            if (isNibbleDisk(this.disk)) {
                data = readSector(this.disk, track, sector);
            } else {
                const offset = track * 0x1000 + sector * 0x100;
                // Slice new array so modifications to apply to original track
                data = new Uint8Array(this.disk.data.slice(offset, offset + 0x100));
            }
        }
        return data;
    }

    /**
     * Creates a classic hex and ascii dump of a sector
     *
     * @param track Track to dump
     * @param sector Sector to dump
     * @returns String representation of sector
     */
    dumpSector(track: byte, sector: byte) {
        let result = '';
        const data = this.rwts(track, sector);
        let b;
        for (let idx = 0; idx < 16; idx++) {
            result += toHex(idx << 4) + ': ';
            for (let jdx = 0; jdx < 16; jdx++) {
                b = data[idx * 16 + jdx];
                result += toHex(b) + ' ';
            }
            result += '        ';
            for (let jdx = 0; jdx < 16; jdx++) {
                b = data[idx * 16 + jdx] & 0x7f;
                if (b >= 0x20 && b < 0x7f) {
                    result += String.fromCharCode(b);
                } else {
                    result += '.';
                }
            }
            result += '\n';
        }
        return result;
    }

    /**
     * Returns all the track sector pairs for a file.
     *
     * @param file File to read
     * @param full Also return track sector map entries
     * @returns Array of file track and sectors
     */
    readFileTrackSectorList(file: FileEntry, full?: boolean) {
        const fileTrackSectorList = [];
        let { track, sector } = file.trackSectorList;
        while (track || sector) {
            if (full) {
                fileTrackSectorList.push({ track, sector });
            }
            let jdx = 0; // offset in sector
            const data = this.rwts(track, sector);
            track = data[0x01];
            sector = data[0x02];
            let offset = 0x0C; // offset in data
            while ((data[offset] || data[offset + 1]) && jdx < 121) {
                fileTrackSectorList.push({
                    track: data[offset],
                    sector: data[offset + 1]
                });
                offset += 2;
                jdx++;
            }
        }
        return fileTrackSectorList;
    }

    /**
     * Read a file from disk
     *
     * @param file File entry to read
     * @returns Data for file, and load address if binary
     */
    readFile(file: FileEntry): FileData {
        let data: byte[] = [];
        let idx;
        const fileTrackSectorList = this.readFileTrackSectorList(file);
        for (idx = 0; idx < fileTrackSectorList.length; idx++) {
            const { track, sector } = fileTrackSectorList[idx];
            data = data.concat([...this.rwts(track, sector)]);
        }
        let offset = 0;
        let length = 0;
        let address = 0;

        switch (file.type) {
            case 'I':
            case 'A':
                offset = 2;
                length = data[0] | data[1] << 8;
                break;
            case 'T':
                length = 0;
                while (data[length]) { length++; }
                break;
            case 'B':
                offset = 4;
                address = data[0] | data[1] << 8;
                length = data[2] | data[3] << 8;
                break;
        }

        data = data.slice(offset, offset + length);

        return { data: new Uint8Array(data), address };
    }

    /**
     * Allocate a new sector for a file in the allocation list
     *
     * @returns track and sector pair
     */
    allocateSector(): TrackSector {
        const { vtoc } = this;
        const findSector = (track: byte) => {
            const sectorMap = vtoc.trackSectorMap[track];
            return sectorMap.findIndex((sector: boolean) => sector);
        };

        const lastTrack = vtoc.lastAllocationTrack;
        let track = lastTrack;
        let sector = findSector(track);
        while (sector === -1) {
            if (vtoc.allocationDirection === 0x01) {
                track = track - 1;
                if (track < 0) {
                    track = vtoc.catalog.track;
                    vtoc.allocationDirection = 0xff;
                }
            } else {
                track = track + 1;
                if (track >= vtoc.trackCount) {
                    throw new Error('Insufficient free space');
                }
            }
            sector = findSector(track);
        }

        vtoc.lastAllocationTrack = track;
        vtoc.trackSectorMap[track][sector] = false;

        return { track, sector };
    }

    /**
     * Compute free sector count.
     *
     * @returns count of free sectors
     */
    freeSectorCount() {
        return this.vtoc.trackSectorMap.reduce((count, flags) => (
            count + flags.reduce((count, flag) => (
                count + (flag ? 1 : 0)
            ), 0)
        ), 0);
    }

    /**
     * Compute used sector count
     *
     * @returns used sector count
     */
    usedSectorCount() {
        return this.vtoc.trackSectorMap.reduce((count, flags) => (
            count + flags.reduce((count, flag) => (
                count + (flag ? 0 : 1)
            ), 0)
        ), 0);
    }

    /**
     * Writes a file to disk. If new file the file entry must also be
     * added to the catalog.
     *
     * @param file File to write
     * @param fileData File data to write, including address if binary
     */
    writeFile(file: FileEntry, fileData: FileData) {
        let prefix: byte[] = [];
        let { data } = fileData;
        switch (file.type) {
            case 'A':
            case 'I':
                prefix = [
                    data.length % 0x100,
                    data.length >> 8
                ];
                break;
            case 'B':
                prefix = [
                    fileData.address % 0x100,
                    fileData.address >> 8,
                    data.length % 0x100,
                    data.length >> 8
                ];
                break;
        }
        data = new Uint8Array(prefix.length + data.length);
        data.set(prefix);
        data.set(data, prefix.length);

        const { sectorByteCount, trackSectorListSize } = this.vtoc;
        const dataRequiredSectors = Math.ceil(data.length / sectorByteCount);
        const fileSectorListRequiredSectors = Math.ceil(dataRequiredSectors / trackSectorListSize);
        const requiredSectors = dataRequiredSectors + fileSectorListRequiredSectors;
        let idx;
        let sectors: TrackSector[] = [];

        if (file.trackSectorList) {
            sectors = this.readFileTrackSectorList(file, true);
        }
        if (sectors.length > requiredSectors) {
            for (idx = requiredSectors; idx < sectors.length; idx++) {
                const { track, sector } = sectors[idx];
                this.vtoc.trackSectorMap[track][sector] = true;
            }
            sectors = sectors.slice(0, requiredSectors);
        }
        if (sectors.length < requiredSectors) {
            for (idx = sectors.length; idx < requiredSectors; idx++) {
                sectors.push(this.allocateSector());
            }
        }
        file.trackSectorList = { ...sectors[0] };
        file.size = requiredSectors;

        let jdx = 0;
        let lastTrackSectorList = null;

        for (idx = 0; idx < dataRequiredSectors; idx++) {
            let sector: TrackSector;
            let sectorData;

            const { trackSectorListSize } = this.vtoc;
            if (idx % trackSectorListSize === 0) {
                sector = sectors.shift() as TrackSector;
                sectorData = new Uint8Array();
                if (lastTrackSectorList) {
                    lastTrackSectorList[0x01] = sector.track;
                    lastTrackSectorList[0x02] = sector.sector;
                }
                sectorData[0x05] = idx & 0xff;
                sectorData[0x06] = idx >> 8;
                for (jdx = 0; jdx < trackSectorListSize && jdx < sectors.length; jdx++) {
                    const offset = 0xC + jdx * 2;
                    sectorData[offset] = sectors[jdx].track;
                    sectorData[offset + 1] = sectors[jdx].sector;
                }
                lastTrackSectorList = sectorData;
                this.rwts(sector.track, sector.sector, new Uint8Array(sectorData));
            }

            sector = sectors.shift() as TrackSector;
            sectorData = new Uint8Array(0x100);
            sectorData.set(data.slice(0, 0x100));
            data = data.slice(0x100);
            this.rwts(sector.track, sector.sector, sectorData);
        }
        this.writeVolumeTOC();
        this.writeCatalog();
    }

    /**
     * Convert a file into a string that can be displayed.
     *
     * @param file File to convert
     * @returns A string representing the file
     */
    dumpFile(file: FileEntry) {
        let result = null;
        const fileData = this.readFile(file);
        switch (file.type) {
            case 'A':
                result = new ApplesoftDump(fileData.data, 0).decompile();
                break;
            case 'I':
                result = new IntegerBASICDump(fileData.data).toString();
                break;
            case 'T':
                result = '';
                for (let idx = 0; idx < fileData.data.length; idx++) {
                    const char = fileData.data[idx] & 0x7f;
                    if (char < 0x20) {
                        if (char === 0xd) { // CR
                            result += '\n';
                        } else {
                            result += `$${toHex(char)}`;
                        }
                    } else {
                        result += String.fromCharCode(char);
                    }
                }
                break;
            case 'B':
            default: {
                result = '';
                let hex = '';
                let ascii = '';
                for (let idx = 0; idx < fileData.data.length; idx++) {
                    const val = fileData.data[idx];
                    if (idx % 16 === 0) {
                        if (idx !== 0) {
                            result += `${hex}    ${ascii}\n`;
                        }
                        hex = '';
                        ascii = '';
                        result += `${toHex(fileData.address + idx, 4)}:`;
                    }
                    hex += ` ${toHex(val)}`;
                    ascii += (val & 0x7f) >= 0x20 ? String.fromCharCode(val & 0x7f) : '.';
                }
                result += '\n';
            } break;
        }
        return result;
    }

    /**
     * Read VTOC data from disk
     *
     * @param trackSector Track and sector to read from, or default
     * @returns VTOC
     */
    readVolumeTOC(trackSector: TrackSector = DEFAULT_VTOC_TRACK_SECTOR) {
        const data = this.rwts(trackSector.track, trackSector.sector);
        this.vtoc = {
            catalog: {
                track: data[VTOC_OFFSETS.CATALOG_TRACK],
                sector: data[VTOC_OFFSETS.CATALOG_SECTOR]
            },
            version: data[VTOC_OFFSETS.VERSION],
            volume: data[VTOC_OFFSETS.VOLUME],
            trackSectorListSize: data[VTOC_OFFSETS.TRACK_SECTOR_LIST_SIZE],
            lastAllocationTrack: data[VTOC_OFFSETS.LAST_ALLOCATION_TRACK],
            allocationDirection: data[VTOC_OFFSETS.ALLOCATION_DIRECTION],
            trackCount: data[VTOC_OFFSETS.TRACK_COUNT],
            sectorCount: data[VTOC_OFFSETS.SECTOR_COUNT],
            sectorByteCount: data[VTOC_OFFSETS.SECTOR_BYTE_COUNT_LOW] |
                (data[VTOC_OFFSETS.SECTOR_BYTE_COUNT_HIGH] << 8),
            trackSectorMap: []
        };

        for (let idx = 0; idx < this.vtoc.trackCount; idx++) {
            const sectorMap = [];
            const offset = 0x38 + idx * 4;
            let bitmap =
                (data[offset] << 24) |
                (data[offset + 1] << 16) |
                (data[offset + 2] << 8) |
                data[offset + 3];

            for (let jdx = 0; jdx < this.vtoc.sectorCount; jdx++) {
                sectorMap.unshift(!!(bitmap & 0x80000000));
                bitmap <<= 1;
            }
            this.vtoc.trackSectorMap.push(sectorMap);
        }

        debug(`DISK VOLUME ${this.vtoc.volume}`);

        return this.vtoc;
    }

    /**
     * Write VTOC data back to disk.
     *
     * @param trackSector Track and sector to read from, or default
     */
    writeVolumeTOC(trackSector: TrackSector = DEFAULT_VTOC_TRACK_SECTOR) {
        const { vtoc } = this;
        const data = new Uint8Array(0x100).fill(0);
        data[VTOC_OFFSETS.CATALOG_TRACK] = vtoc.catalog.track;
        data[VTOC_OFFSETS.CATALOG_SECTOR] = vtoc.catalog.sector;
        data[VTOC_OFFSETS.VERSION] = vtoc.version || 3;
        data[VTOC_OFFSETS.VOLUME] = vtoc.volume || 0xFE;
        data[VTOC_OFFSETS.TRACK_SECTOR_LIST_SIZE] = vtoc.trackSectorListSize || 0x7a;
        data[VTOC_OFFSETS.LAST_ALLOCATION_TRACK] = vtoc.lastAllocationTrack;
        data[VTOC_OFFSETS.ALLOCATION_DIRECTION] = vtoc.allocationDirection;
        data[VTOC_OFFSETS.TRACK_COUNT] = vtoc.trackCount;
        data[VTOC_OFFSETS.SECTOR_COUNT] = vtoc.sectorCount;
        data[VTOC_OFFSETS.SECTOR_BYTE_COUNT_LOW] = vtoc.sectorByteCount & 0xff;
        data[VTOC_OFFSETS.SECTOR_BYTE_COUNT_HIGH] = vtoc.sectorByteCount >> 8;

        for (let idx = 0; idx < vtoc.trackSectorMap.length; idx++) {
            const offset = 0x38 + idx * 4;
            const sectorMap = vtoc.trackSectorMap[idx];

            let mask = 0;
            for (let jdx = 0; jdx < sectorMap.length; jdx++) {
                mask >>= 1;
                if (sectorMap[jdx]) {
                    mask |= 0x80000000;
                }
            }

            data[offset] = (mask >> 24) & 0xff;
            data[offset + 1] = (mask >> 16) & 0xff;
            data[offset + 2] = (mask >> 8) & 0xff;
            data[offset + 3] = mask & 0xff;
        }
        this.rwts(trackSector.track, trackSector.sector, data);
    }

    /**
     * Reads catalog from disk.
     *
     * @returns Catalog entries
     */
    readCatalog(): FileEntry[] {
        const { catalog } = this.vtoc;
        this.files = [];

        let catTrack = catalog.track;
        let catSector = catalog.sector;
        while (catSector || catTrack) {
            const data = this.rwts(catTrack, catSector);

            catTrack = data[CATALOG_OFFSETS.NEXT_CATALOG_TRACK];
            catSector = data[CATALOG_OFFSETS.NEXT_CATALOG_SECTOR];

            for (let idx = CATALOG_OFFSETS.ENTRY1; idx < 0x100; idx += CATALOG_ENTRY_LENGTH) {
                const file: FileEntry = {
                    locked: false,
                    deleted: false,
                    type: 'A',
                    size: 0,
                    name: '',
                    trackSectorList: { track: 0, sector: 0 },
                };
                let str = '';
                const entry = data.slice(idx, idx + CATALOG_ENTRY_LENGTH);

                if (!entry[CATALOG_ENTRY_OFFSETS.SECTOR_LIST_TRACK]) {
                    continue;
                }

                file.trackSectorList = {
                    track: entry[CATALOG_ENTRY_OFFSETS.SECTOR_LIST_TRACK],
                    sector: entry[CATALOG_ENTRY_OFFSETS.SECTOR_LIST_SECTOR]
                };

                if (file.trackSectorList.track === 0xff) {
                    file.deleted = true;
                    file.trackSectorList.track = entry[CATALOG_ENTRY_OFFSETS.FILE_NAME + 0x20];
                }

                // Locked
                if (entry[CATALOG_ENTRY_OFFSETS.FILE_TYPE] & 0x80) {
                    file.locked = true;
                }

                str += file.locked ? '*' : ' ';

                // File type
                switch (entry[CATALOG_ENTRY_OFFSETS.FILE_TYPE] & 0x7f) {
                    case 0x00:
                        file.type = 'T';
                        break;
                    case 0x01:
                        file.type = 'I';
                        break;
                    case 0x02:
                        file.type = 'A';
                        break;
                    case 0x04:
                        file.type = 'B';
                        break;
                    case 0x08:
                        file.type = 'S';
                        break;
                    case 0x10:
                        file.type = 'R';
                        break;
                    case 0x20:
                        file.type = 'A';
                        break;
                    case 0x40:
                        file.type = 'B';
                        break;
                }
                str += file.type;
                str += ' ';

                // Size
                file.size = entry[CATALOG_ENTRY_OFFSETS.FILE_LENGTH_LOW] |
                    entry[CATALOG_ENTRY_OFFSETS.FILE_LENGTH_HIGH] << 8;
                str += Math.floor(file.size / 100);
                str += Math.floor(file.size / 10) % 10;
                str += file.size % 10;
                str += ' ';

                // Filename
                for (let jdx = CATALOG_ENTRY_OFFSETS.FILE_NAME; jdx < 0x21; jdx++) {
                    file.name += String.fromCharCode(entry[jdx] & 0x7f);
                }
                str += file.name;
                debug(str);
                this.files.push(file);
            }
        }
        return this.files;
    }

    /**
     * Writes catalog back to disk
     */
    writeCatalog() {
        const { catalog } = this.vtoc;

        let catTrack = catalog.track;
        let catSector = catalog.sector;
        while (catSector || catTrack) {
            const data = this.rwts(catTrack, catSector);

            for (let idx = CATALOG_OFFSETS.ENTRY1; idx < 0x100; idx += CATALOG_ENTRY_OFFSETS.SECTOR_LIST_TRACK) {
                const file = this.files.shift();

                if (!file?.trackSectorList) {
                    continue;
                }

                data[idx + CATALOG_ENTRY_OFFSETS.SECTOR_LIST_TRACK] = file.trackSectorList.track;
                data[idx + CATALOG_ENTRY_OFFSETS.SECTOR_LIST_SECTOR] = file.trackSectorList.sector;

                data[idx + CATALOG_ENTRY_OFFSETS.FILE_TYPE] = file.locked ? 0x80 : 0x00;

                // File type
                switch (file.type) {
                    case 'T':
                        break;
                    case 'I':
                        data[idx + CATALOG_ENTRY_OFFSETS.FILE_TYPE] |= 0x01;
                        break;
                    case 'A':
                        data[idx + CATALOG_ENTRY_OFFSETS.FILE_TYPE] |= 0x02;
                        break;
                    case 'B':
                        data[idx + CATALOG_ENTRY_OFFSETS.FILE_TYPE] |= 0x04;
                        break;
                    case 'S':
                        data[idx + CATALOG_ENTRY_OFFSETS.FILE_TYPE] |= 0x08;
                        break;
                    case 'R':
                        data[idx + CATALOG_ENTRY_OFFSETS.FILE_TYPE] |= 0x10;
                        break;
                }

                // Size
                data[idx + CATALOG_ENTRY_OFFSETS.FILE_LENGTH_LOW] = file.size & 0xff;
                data[idx + CATALOG_ENTRY_OFFSETS.FILE_LENGTH_HIGH] = file.size >> 8;

                // Filename
                for (let jdx = 0; jdx < 0x1E; jdx++) {
                    data[idx + CATALOG_ENTRY_OFFSETS.FILE_NAME + jdx] = file.name.charCodeAt(jdx) | 0x80;
                }
            }
            this.rwts(catTrack, catSector, data);

            catTrack = data[CATALOG_OFFSETS.NEXT_CATALOG_TRACK];
            catSector = data[CATALOG_OFFSETS.NEXT_CATALOG_SECTOR];
        }
    }

    /**
     * Return the volume number from the VTOC
     *
     * @returns Volume number
     */
    getVolumeNumber() {
        return this.vtoc.volume;
    }
}

/**
 * Very lose check for DOS disks, currently simply checks for the
 * version byte in the probable VTOC.
 *
 * @param disk Image to check for DOS
 * @returns true if VTOC version byte is 3
 */
export function isMaybeDOS33(disk: NibbleDisk | MassStorageData) {
    let data;
    if (isNibbleDisk(disk)) {
        data = readSector(disk, DEFAULT_VTOC_TRACK, DEFAULT_VTOC_SECTOR);
    } else if (disk.data.byteLength > 0) {
        data = new Uint8Array(
            disk.data,
            DEFAULT_VTOC_TRACK * 4096 + DEFAULT_VTOC_SECTOR * 0x100,
            0x100
        );
    } else {
        return false;
    }
    return data[VTOC_OFFSETS.VERSION] === 3;
}
