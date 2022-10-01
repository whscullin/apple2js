import { DriveNumber, SupportedSectors } from 'js/formats/types';
import { byte, nibble } from 'js/types';

export type LssClockCycle = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type LssState = nibble;

export type Phase = 0 | 1 | 2 | 3;

/**
 * State of the controller.
 */
export interface ControllerState {
    /** Sectors supported by the controller. */
    sectors: SupportedSectors;

    /** Is the active drive powered on? */
    on: boolean;

    /** The active drive. */
    driveNo: DriveNumber;

    /** The 8-cycle LSS clock. */
    clock: LssClockCycle;

    /** Current state of the Logic State Sequencer. */
    state: LssState;

    /** Q6 (Shift/Load) */
    q6: boolean;
    /** Q7 (Read/Write) */
    q7: boolean;

    /** Last data from the disk drive. */
    latch: byte;
    /** Last data written by the CPU to card softswitch 0x8D. */
    bus: byte;
}

/** Common information for Nibble and WOZ disks. */
export interface Drive {
    /** Whether the drive write protect is on. */
    readOnly: boolean;
    /** Quarter track position of read/write head. */
    track: byte;
    /** Position of the head on the track. */
    head: byte;
    /** Current active coil in the head stepper motor. */
    phase: Phase;
    /** Whether the drive has been written to since it was loaded. */
    dirty: boolean;
}

/** Base interface for disk driver states. */
export interface DriverState {}

/** Interface for drivers for various disk types. */
export interface DiskDriver {
    tick(): void;
    onQ6Low(): void;
    onQ6High(readMode: boolean): void;
    onDriveOn(): void;
    onDriveOff(): void;
    clampTrack(): void;
    getState(): DriverState;
    setState(state: DriverState): void;
}
