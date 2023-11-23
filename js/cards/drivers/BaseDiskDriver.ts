import { DriveNumber, NibbleDisk, WozDisk } from '../../formats/types';
import { ControllerState, DiskDriver, Drive, DriverState } from './types';

/**
 * Common logic for both `NibbleDiskDriver` and `WozDiskDriver`.
 */
export abstract class BaseDiskDriver implements DiskDriver {
    constructor(
        protected readonly driveNo: DriveNumber,
        protected readonly drive: Drive,
        protected readonly disk: NibbleDisk | WozDisk,
        protected readonly controller: ControllerState
    ) {}

    /** Called frequently to ensure the disk is spinning. */
    abstract tick(): void;

    /** Called when Q6 is set LOW. */
    abstract onQ6Low(): void;

    /** Called when Q6 is set HIGH. */
    abstract onQ6High(readMode: boolean): void;

    /**
     * Called when drive is turned on. This is guaranteed to be called
     * only when the associated drive is toggled from off to on. This
     * is also guaranteed to be called when a new disk is inserted when
     * the drive is already on.
     */
    abstract onDriveOn(): void;

    /**
     * Called when drive is turned off. This is guaranteed to be called
     * only when the associated drive is toggled from on to off.
     */
    abstract onDriveOff(): void;

    debug(..._args: unknown[]) {
        // debug(...args);
    }

    /**
     * Called every time the head moves to clamp the track to a valid
     * range.
     */
    abstract clampTrack(): void;

    /** Returns `true` if the controller is on and this drive is selected. */
    isOn(): boolean {
        return this.controller.on && this.controller.driveNo === this.driveNo;
    }

    /** Returns `true` if the drive's write protect switch is enabled. */
    isWriteProtected(): boolean {
        return this.drive.readOnly;
    }

    /** Returns the current state of the driver as a serializable object. */
    abstract getState(): DriverState;

    /** Sets the state of the driver from the given `state`. */
    abstract setState(state: DriverState): void;
}
