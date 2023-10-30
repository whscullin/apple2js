import { byte } from 'js/types';
import { concat } from 'js/util';
import { D13O, DO, explodeSector13, explodeSector16, PO } from './format_utils';
import { ByteSource, Metadata, MetadataSource, NibbleTrackSource, TrackSectorSource } from './types';

export class FileHandleFileSource {
    constructor(private readonly fileHandle: FileSystemFileHandle) { }

    getFile(): Promise<File> {
        return this.fileHandle.getFile();
    }
}

export class FileHandleMetadataSource implements MetadataSource {
    constructor(private readonly fileHandle: FileSystemFileHandle) { }

    getMetadata(): Metadata {
        return {
            name: this.fileHandle.name,
        };
    }
}

export class FileByteArraySource {
    constructor(private readonly file: File) { }

    async getBytes() {
        return new Uint8Array(await this.file.arrayBuffer());
    }
}

export class ByteArrayByteSource implements ByteSource {
    constructor(private readonly byteArray: Uint8Array) { }

    read(offset: number, length: number): Uint8Array {
        return this.byteArray.subarray(offset, offset + length);
    }

    length(): number {
        return this.byteArray.length;
    }
}

export class ByteArrayArrayTrackSectorSource implements TrackSectorSource {
    constructor(
        protected readonly data: Uint8Array[][]) { }

    read(track: number, sector: number): Uint8Array {
        return this.data[track][sector];
    }

    numTracks(): number {
        return this.data.length;
    }
}

export class ByteTrackSectorSource implements TrackSectorSource {
    constructor(
        protected readonly byteSource: ByteSource,
        protected readonly sectors = 16) { }

    read(track: number, sector: number): Uint8Array {
        return this.byteSource.read((track * this.sectors + sector) * 256, 256);
    }

    numTracks(): number {
        let tracks = this.byteSource.length() / (this.sectors * 256);
        if (tracks !== Math.floor(tracks)) {
            tracks = Math.floor(tracks + 1);
        }
        return tracks;
    }
}

export class ProdosOrderedTrackSectorSource implements TrackSectorSource {
    constructor(private readonly trackSectorSource: TrackSectorSource) { }

    read(track: number, sector: number): Uint8Array {
        return this.trackSectorSource.read(track, PO[sector]);
    }

    numTracks(): number {
        return this.trackSectorSource.numTracks();
    }
}

export class DosOrderedTrackSectorSource implements TrackSectorSource {
    constructor(private readonly trackSectorSource: TrackSectorSource) { }

    read(track: number, sector: number): Uint8Array {
        return this.trackSectorSource.read(track, DO[sector]);
    }

    numTracks(): number {
        return this.trackSectorSource.numTracks();
    }
}

export class TrackSector6x2NibbleTrackSource implements NibbleTrackSource {
    constructor(
        private readonly trackSectorSource: TrackSectorSource,
        private readonly volume: byte = 254) {
    }

    read(track: number): Uint8Array {
        const sectors: byte[][] = [];
        for (let sector = 0; sector < 16; sector++) {
            const data = this.trackSectorSource.read(track, sector);
            sectors.push(explodeSector16(this.volume, track, sector, data));
        }
        return concat(...sectors);
    }

    numTracks(): number {
        return this.trackSectorSource.numTracks();
    }
}

export class TrackSector5x3NibbleTrackSource implements NibbleTrackSource {
    constructor(
        private readonly trackSectorSource: TrackSectorSource,
        private readonly volume: byte = 254) {
    }

    /*
    * DOS 13-sector disks have the physical sectors skewed on the track. The skew
    * between physical sectors is 10 (A), resulting in the following physical order:
    *
    *   0 A 7 4 1 B 8 5 2 C 9 6 3
    *
    * Note that because physical sector == logical sector, this works slightly
    * differently from the DOS and ProDOS nibblizers.
    */
    read(track: number): Uint8Array {
        const sectors: byte[][] = [];
        for (let sector = 0; sector < 13; sector++) {
            const physical_sector = D13O[sector];
            const data = this.trackSectorSource.read(track, physical_sector);
            sectors.push(explodeSector13(this.volume, track, physical_sector, data));
        }
        return concat(...sectors);
    }

    numTracks(): number {
        return this.trackSectorSource.numTracks();
    }
}

