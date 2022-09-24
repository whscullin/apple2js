import { DriveNumber, NibbleDisk } from '../../formats/types';
import { BaseDiskDriver } from './BaseDiskDriver';
import { ControllerState, Drive, DriverState } from './types';

interface NibbleDiskDriverState extends DriverState {
    skip: number;
    nibbleCount: number;
}

export class NibbleDiskDriver extends BaseDiskDriver {
    /**
     * When `1`, the next nibble will be available for read; when `0`,
     * the card is pretending to wait for data to be shifted in by the
     * sequencer.
     */
    private skip: number = 0;
    /** Number of nibbles reads since the drive was turned on. */
    private nibbleCount: number = 0;

    constructor(
        driveNo: DriveNumber,
        drive: Drive,
        readonly disk: NibbleDisk,
        controller: ControllerState,
        private readonly onDirty: () => void) {
        super(driveNo, drive, disk, controller);
    }

    tick(): void {
        // do nothing
    }

    onQ6Low(): void {
        const drive = this.drive;
        const disk = this.disk;
        if (this.isOn() && (this.skip || this.controller.q7)) {
            const track = disk.tracks[drive.track >> 2];
            if (track && track.length) {
                if (drive.head >= track.length) {
                    drive.head = 0;
                }

                if (this.controller.q7) {
                    const writeProtected = disk.readOnly;
                    if (!writeProtected) {
                        track[drive.head] = this.controller.bus;
                        drive.dirty = true;
                        this.onDirty();
                    }
                } else {
                    this.controller.latch = track[drive.head];
                    this.nibbleCount++;
                }

                ++drive.head;
            }
        } else {
            this.controller.latch = 0;
        }
        this.skip = (++this.skip % 2);
    }

    onQ6High(readMode: boolean): void {
        const drive = this.drive;
        if (readMode && !this.controller.q7) {
            const writeProtected = drive.readOnly;
            if (writeProtected) {
                this.controller.latch = 0xff;
                this.debug('Setting readOnly');
            } else {
                this.controller.latch >>= 1;
                this.debug('Clearing readOnly');
            }
        }
    }

    onDriveOn(): void {
        this.nibbleCount = 0;
    }

    onDriveOff(): void {
        this.debug('nibbles read', this.nibbleCount);
    }

    clampTrack(): void {
        // For NibbleDisks, the emulator clamps the track to the available
        // range.
        if (this.drive.track < 0) {
            this.drive.track = 0;
        }
        const lastTrack = 35 * 4 - 1;
        if (this.drive.track > lastTrack) {
            this.drive.track = lastTrack;
        }
    }

    getState(): NibbleDiskDriverState {
        const { skip, nibbleCount } = this;
        return { skip, nibbleCount };
    }

    setState(state: NibbleDiskDriverState) {
        this.skip = state.skip;
        this.nibbleCount = state.nibbleCount;
    }
}
