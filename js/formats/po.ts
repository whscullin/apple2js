import { NibbleDisk, DiskOptions, ENCODING_NIBBLE, TrackSectorSource } from './types';
import { ByteArrayArrayTrackSectorSource, ByteArrayByteSource, ByteTrackSectorSource, ProdosOrderedTrackSectorSource, TrackSector6x2NibbleTrackSource } from './sources';

/**
 * Returns a `Disk` object from ProDOS-ordered image data.
 * @param options the disk image and options
 * @returns A nibblized disk
 */
export default function createDiskFromProDOS(options: DiskOptions) {
    const { data, name, side, rawData, volume, readOnly } = options;
    const disk: NibbleDisk = {
        format: 'po',
        encoding: ENCODING_NIBBLE,
        metadata: { name, side },
        volume: volume || 254,
        tracks: [],
        readOnly: readOnly || false,
    };

    let trackSectorSource: TrackSectorSource;
    if (rawData) {
        trackSectorSource =
            new ByteTrackSectorSource(
                new ByteArrayByteSource(new Uint8Array(rawData)));
    } else if (data) {
        trackSectorSource = new ByteArrayArrayTrackSectorSource(data);
    } else {
        throw new Error('Requires data or rawData');
    }

    const nibbleTrackSource =
        new TrackSector6x2NibbleTrackSource(
            new ProdosOrderedTrackSectorSource(trackSectorSource), volume);

    for (let physical_track = 0; physical_track < nibbleTrackSource.numTracks(); physical_track++) {
        disk.tracks[physical_track] = nibbleTrackSource.read(physical_track);
    }

    return disk;
}
