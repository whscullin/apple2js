import { DiskDriver, Drive, DriverState } from './types';

/** Returned state for an empty drive. */
export interface EmptyDriverState extends DriverState { }

/**
 * Driver for empty drives. This implementation does nothing except keep
 * the head clamped between tracks 0 and 34.
 */
export class EmptyDriver implements DiskDriver {
    constructor(private readonly drive: Drive) { }

    tick(): void {
        // do nothing
    }

    onQ6Low(): void {
        // do nothing
    }

    onQ6High(_readMode: boolean): void {
        // do nothing
    }

    onDriveOn(): void {
        // do nothing
    }

    onDriveOff(): void {
        // do nothing
    }

    clampTrack(): void {
        // For empty drives, the emulator clamps the track to 0 to 34,
        // but real Disk II drives can seek past track 34 by at least a
        // half track, usually a full track. Some 3rd party drives can
        // seek to track 39.
        if (this.drive.track < 0) {
            this.drive.track = 0;
        }
        if (this.drive.track > 34) {
            this.drive.track = 34;
        }
    }

    getState() {
        return {};
    }

    setState(_state: EmptyDriverState): void {
        // do nothing
    }
}
