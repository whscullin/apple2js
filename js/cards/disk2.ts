import { base64_encode } from '../base64';
import type { byte, Card, ReadonlyUint8Array } from '../types';

import {
    DISK_PROCESSED,
    DriveNumber,
    DRIVE_NUMBERS,
    FloppyDisk,
    FloppyFormat,
    FormatWorkerMessage,
    FormatWorkerResponse,
    isNibbleDisk,
    isNoFloppyDisk,
    isWozDisk,
    JSONDisk,
    MassStorage,
    MassStorageData,
    NibbleDisk,
    NibbleFormat,
    NO_DISK,
    PROCESS_BINARY,
    PROCESS_JSON,
    PROCESS_JSON_DISK,
    SupportedSectors,
    WozDisk,
} from '../formats/types';

import { createDisk, createDiskFromJsonDisk } from '../formats/create_disk';

import {
    jsonDecode,
    jsonEncode,
    readSector,
    _D13O,
    _DO,
    _PO,
} from '../formats/format_utils';

import Apple2IO from '../apple2io';

import { BOOTSTRAP_ROM_13, BOOTSTRAP_ROM_16 } from '../roms/cards/disk2';

import { EmptyDriver } from './drivers/EmptyDriver';
import { NibbleDiskDriver } from './drivers/NibbleDiskDriver';
import {
    ControllerState,
    DiskDriver,
    Drive,
    DriverState,
    Phase,
} from './drivers/types';
import { WozDiskDriver } from './drivers/WozDiskDriver';

/** Softswitch locations */
const LOC = {
    // Disk II Controller Commands
    // See Understanding the Apple IIe, Table 9.1
    PHASE0OFF: 0x80, // Q0L: Phase 0 OFF
    PHASE0ON: 0x81, // Q0H: Phase 0 ON
    PHASE1OFF: 0x82, // Q1L: Phase 1 OFF
    PHASE1ON: 0x83, // Q1H: Phase 1 ON
    PHASE2OFF: 0x84, // Q2L: Phase 2 OFF
    PHASE2ON: 0x85, // Q2H: Phase 2 ON
    PHASE3OFF: 0x86, // Q3L: Phase 3 OFF
    PHASE3ON: 0x87, // Q3H: Phase 3 ON

    DRIVEOFF: 0x88, // Q4L: Drives OFF
    DRIVEON: 0x89, // Q4H: Selected drive ON
    DRIVE1: 0x8a, // Q5L: Select drive 1
    DRIVE2: 0x8b, // Q5H: Select drive 2
    DRIVEREAD: 0x8c, // Q6L: Shift while writing; read data
    DRIVEWRITE: 0x8d, // Q6H: Load while writing; read write protect
    DRIVEREADMODE: 0x8e, // Q7L: Read
    DRIVEWRITEMODE: 0x8f, // Q7H: Write
} as const;

/** Logic state sequencer ROM */
// See Understanding the Apple IIe, Table 9.3 Logic State Sequencer Commands
//       CODE  OPERATION              BEFORE    AFTER
// 0     CLR                          XXXXXXXX  00000000
// 8     NOP                          ABCDEFGH  ABCDEFGH
// 9     SL0                          ABCDEFGH  BCDEFGH0
// A     SR   (write protected)       ABCDEFGH  11111111
//            (not write protected)   ABCDEFGH  0ABCDEFG
// B     LOAD                         XXXXXXXX  YYYYYYYY
// D     SL1                          ABCDEFGH  BCDEFGH1

// prettier-ignore
const SEQUENCER_ROM_13 = [
    // See Understanding the Apple IIe, Figure 9.10 The DOS 3.2 Logic State Sequencer
    // Note that the column order here is NOT the same as in Figure 9.10 for Q7 H (Write).
    //
    //                Q7 L (Read)                                     Q7 H (Write)
    //    Q6 L (Shift)            Q6 H (Load)             Q6 L (Shift)             Q6 H (Load)
    //  QA L        QA H        QA L        QA H        QA L        QA H        QA L        QA H
    // 1     0     1     0     1     0     1     0     1     0     1     0     1     0     1     0
    0xD8, 0x18, 0x18, 0x08, 0x0A, 0x0A, 0x0A, 0x0A, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, // 0
    0xD8, 0x2D, 0x28, 0x28, 0x0A, 0x0A, 0x0A, 0x0A, 0x28, 0x28, 0x28, 0x28, 0x28, 0x28, 0x28, 0x28, // 1
    0xD8, 0x38, 0x38, 0x38, 0x0A, 0x0A, 0x0A, 0x0A, 0x39, 0x39, 0x39, 0x39, 0x3B, 0x3B, 0x3B, 0x3B, // 2
    0xD8, 0x48, 0xD8, 0x48, 0x0A, 0x0A, 0x0A, 0x0A, 0x48, 0x48, 0x48, 0x48, 0x48, 0x48, 0x48, 0x48, // 3
    0xD8, 0x58, 0xD8, 0x58, 0x0A, 0x0A, 0x0A, 0x0A, 0x58, 0x58, 0x58, 0x58, 0x58, 0x58, 0x58, 0x58, // 4
    0xD8, 0x68, 0xD8, 0x68, 0x0A, 0x0A, 0x0A, 0x0A, 0x68, 0x68, 0x68, 0x68, 0x68, 0x68, 0x68, 0x68, // 5
    0xD8, 0x78, 0xD8, 0x78, 0x0A, 0x0A, 0x0A, 0x0A, 0x78, 0x78, 0x78, 0x78, 0x78, 0x78, 0x78, 0x78, // 6
    0xD8, 0x88, 0xD8, 0x88, 0x0A, 0x0A, 0x0A, 0x0A, 0x08, 0x08, 0x88, 0x88, 0x08, 0x08, 0x88, 0x88, // 7
    0xD8, 0x98, 0xD8, 0x98, 0x0A, 0x0A, 0x0A, 0x0A, 0x98, 0x98, 0x98, 0x98, 0x98, 0x98, 0x98, 0x98, // 8
    0xD8, 0x09, 0xD8, 0xA8, 0x0A, 0x0A, 0x0A, 0x0A, 0xA8, 0xA8, 0xA8, 0xA8, 0xA8, 0xA8, 0xA8, 0xA8, // 9
    0xCD, 0xBD, 0xD8, 0xB8, 0x0A, 0x0A, 0x0A, 0x0A, 0xB9, 0xB9, 0xB9, 0xB9, 0xBB, 0xBB, 0xBB, 0xBB, // A
    0xD9, 0x39, 0xD8, 0xC8, 0x0A, 0x0A, 0x0A, 0x0A, 0xC8, 0xC8, 0xC8, 0xC8, 0xC8, 0xC8, 0xC8, 0xC8, // B
    0xD9, 0xD9, 0xD8, 0xA0, 0x0A, 0x0A, 0x0A, 0x0A, 0xD8, 0xD8, 0xD8, 0xD8, 0xD8, 0xD8, 0xD8, 0xD8, // C
    0x1D, 0x0D, 0xE8, 0xE8, 0x0A, 0x0A, 0x0A, 0x0A, 0xE8, 0xE8, 0xE8, 0xE8, 0xE8, 0xE8, 0xE8, 0xE8, // D
    0xFD, 0xFD, 0xF8, 0xF8, 0x0A, 0x0A, 0x0A, 0x0A, 0xF8, 0xF8, 0xF8, 0xF8, 0xF8, 0xF8, 0xF8, 0xF8, // E
    0xDD, 0x4D, 0xE0, 0xE0, 0x0A, 0x0A, 0x0A, 0x0A, 0x88, 0x88, 0x08, 0x08, 0x88, 0x88, 0x08, 0x08  // F
] as const;

// prettier-ignore
const SEQUENCER_ROM_16 = [
    // See Understanding the Apple IIe, Figure 9.11 The DOS 3.3 Logic State Sequencer
    // Note that the column order here is NOT the same as in Figure 9.11 for Q7 H (Write).
    //
    //                Q7 L (Read)                                     Q7 H (Write)
    //    Q6 L (Shift)            Q6 H (Load)             Q6 L (Shift)             Q6 H (Load)
    //  QA L        QA H        QA L        QA H        QA L        QA H        QA L        QA H
    // 1     0     1     0     1     0     1     0     1     0     1     0     1     0     1     0
    0x18, 0x18, 0x18, 0x18, 0x0A, 0x0A, 0x0A, 0x0A, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, // 0
    0x2D, 0x2D, 0x38, 0x38, 0x0A, 0x0A, 0x0A, 0x0A, 0x28, 0x28, 0x28, 0x28, 0x28, 0x28, 0x28, 0x28, // 1
    0xD8, 0x38, 0x08, 0x28, 0x0A, 0x0A, 0x0A, 0x0A, 0x39, 0x39, 0x39, 0x39, 0x3B, 0x3B, 0x3B, 0x3B, // 2
    0xD8, 0x48, 0x48, 0x48, 0x0A, 0x0A, 0x0A, 0x0A, 0x48, 0x48, 0x48, 0x48, 0x48, 0x48, 0x48, 0x48, // 3
    0xD8, 0x58, 0xD8, 0x58, 0x0A, 0x0A, 0x0A, 0x0A, 0x58, 0x58, 0x58, 0x58, 0x58, 0x58, 0x58, 0x58, // 4
    0xD8, 0x68, 0xD8, 0x68, 0x0A, 0x0A, 0x0A, 0x0A, 0x68, 0x68, 0x68, 0x68, 0x68, 0x68, 0x68, 0x68, // 5
    0xD8, 0x78, 0xD8, 0x78, 0x0A, 0x0A, 0x0A, 0x0A, 0x78, 0x78, 0x78, 0x78, 0x78, 0x78, 0x78, 0x78, // 6
    0xD8, 0x88, 0xD8, 0x88, 0x0A, 0x0A, 0x0A, 0x0A, 0x08, 0x08, 0x88, 0x88, 0x08, 0x08, 0x88, 0x88, // 7
    0xD8, 0x98, 0xD8, 0x98, 0x0A, 0x0A, 0x0A, 0x0A, 0x98, 0x98, 0x98, 0x98, 0x98, 0x98, 0x98, 0x98, // 8
    0xD8, 0x29, 0xD8, 0xA8, 0x0A, 0x0A, 0x0A, 0x0A, 0xA8, 0xA8, 0xA8, 0xA8, 0xA8, 0xA8, 0xA8, 0xA8, // 9
    0xCD, 0xBD, 0xD8, 0xB8, 0x0A, 0x0A, 0x0A, 0x0A, 0xB9, 0xB9, 0xB9, 0xB9, 0xBB, 0xBB, 0xBB, 0xBB, // A
    0xD9, 0x59, 0xD8, 0xC8, 0x0A, 0x0A, 0x0A, 0x0A, 0xC8, 0xC8, 0xC8, 0xC8, 0xC8, 0xC8, 0xC8, 0xC8, // B
    0xD9, 0xD9, 0xD8, 0xA0, 0x0A, 0x0A, 0x0A, 0x0A, 0xD8, 0xD8, 0xD8, 0xD8, 0xD8, 0xD8, 0xD8, 0xD8, // C
    0xD8, 0x08, 0xE8, 0xE8, 0x0A, 0x0A, 0x0A, 0x0A, 0xE8, 0xE8, 0xE8, 0xE8, 0xE8, 0xE8, 0xE8, 0xE8, // D
    0xFD, 0xFD, 0xF8, 0xF8, 0x0A, 0x0A, 0x0A, 0x0A, 0xF8, 0xF8, 0xF8, 0xF8, 0xF8, 0xF8, 0xF8, 0xF8, // E
    0xDD, 0x4D, 0xE0, 0xE0, 0x0A, 0x0A, 0x0A, 0x0A, 0x88, 0x88, 0x08, 0x08, 0x88, 0x88, 0x08, 0x08  // F
] as const;

/** Contents of the P6 sequencer ROM. */
export const SEQUENCER_ROM: Record<SupportedSectors, ReadonlyArray<byte>> = {
    13: SEQUENCER_ROM_13,
    16: SEQUENCER_ROM_16,
} as const;

/** Contents of the P5 ROM at 0xCnXX. */
const BOOTSTRAP_ROM: Record<SupportedSectors, ReadonlyUint8Array> = {
    13: BOOTSTRAP_ROM_13,
    16: BOOTSTRAP_ROM_16,
} as const;

/**
 * How far the head moves, in quarter tracks, when in phase X and phase Y is
 * activated. For example, if in phase 0 (top row), turning on phase 3 would
 * step backwards a quarter track while turning on phase 2 would step forwards
 * a half track.
 *
 * Note that this emulation is highly simplified as it only takes into account
 * the order that coils are powered on and ignores when they are powered off.
 * The actual hardware allows for multiple coils to be powered at the same time
 * providing different levels of torque on the head arm. Along with that, the
 * RWTS uses a complex delay system to drive the coils faster based on expected
 * head momentum.
 *
 * Examining the https://computerhistory.org/blog/apple-ii-dos-source-code/,
 * one finds the SEEK routine on line 4831 of `appdos31.lst`. It uses `ONTABLE`
 * and `OFFTABLE` (each 12 bytes) to know exactly how many microseconds to
 * power on/off each coil as the head accelerates. At the end, the final coil
 * is left powered on 9.5 milliseconds to ensure the head has settled.
 *
 * https://embeddedmicro.weebly.com/apple-2iie.html shows traces of the boot
 * seek (which is slightly different) and a regular seek.
 */
const PHASE_DELTA = [
    [0, 1, 2, -1],
    [-1, 0, 1, 2],
    [-2, -1, 0, 1],
    [1, -2, -1, 0],
] as const;

/** Callbacks triggered by events of the drive or controller. */
export interface Callbacks {
    /** Called when a drive turns on or off. */
    driveLight: (driveNo: DriveNumber, on: boolean) => void;
    /**
     * Called when a disk has been written to. For performance and integrity,
     * this is only called when the drive stops spinning or is removed from
     * the drive.
     */
    dirty: (driveNo: DriveNumber, dirty: boolean) => void;
    /** Called when a disk is inserted or removed from the drive. */
    label: (driveNo: DriveNumber, name?: string, side?: string) => void;
}

interface DriveState {
    disk: FloppyDisk;
    driver: DriverState;
    readOnly: boolean;
    track: byte;
    head: byte;
    phase: Phase;
    dirty: boolean;
}

/** State of the controller for saving/restoring. */
interface State {
    drives: DriveState[];
    controllerState: ControllerState;
}

function getDiskState(disk: FloppyDisk): FloppyDisk {
    if (isNoFloppyDisk(disk)) {
        const { encoding, metadata, readOnly } = disk;
        return {
            encoding,
            metadata: { ...metadata },
            readOnly,
        };
    }
    if (isNibbleDisk(disk)) {
        const { format, encoding, metadata, readOnly, volume, tracks } = disk;
        const result: NibbleDisk = {
            format,
            encoding,
            volume,
            tracks: [],
            readOnly,
            metadata: { ...metadata },
        };
        for (let idx = 0; idx < tracks.length; idx++) {
            result.tracks.push(new Uint8Array(tracks[idx]));
        }
        return result;
    }

    if (isWozDisk(disk)) {
        const { format, encoding, metadata, readOnly, trackMap, rawTracks } =
            disk;
        const result: WozDisk = {
            format,
            encoding,
            readOnly,
            trackMap: [],
            rawTracks: [],
            metadata: { ...metadata },
            info: disk.info,
        };
        result.trackMap = [...trackMap];
        for (let idx = 0; idx < rawTracks.length; idx++) {
            result.rawTracks.push(new Uint8Array(rawTracks[idx]));
        }
        return result;
    }

    throw new Error('Unknown drive state');
}

/**
 * Emulates the 16-sector and 13-sector versions of the Disk ][ drive and controller.
 */
export default class DiskII implements Card<State>, MassStorage<NibbleFormat> {
    private drives: Record<DriveNumber, Drive> = {
        1: {
            // Drive 1
            track: 0,
            head: 0,
            phase: 0,
            readOnly: false,
            dirty: false,
        },
        2: {
            // Drive 2
            track: 0,
            head: 0,
            phase: 0,
            readOnly: false,
            dirty: false,
        },
    };

    private disks: Record<DriveNumber, FloppyDisk> = {
        1: {
            encoding: NO_DISK,
            readOnly: false,
            metadata: { name: 'Disk 1' },
        },
        2: {
            encoding: NO_DISK,
            readOnly: false,
            metadata: { name: 'Disk 2' },
        },
    };

    private driver: Record<DriveNumber, DiskDriver> = {
        1: new EmptyDriver(this.drives[1]),
        2: new EmptyDriver(this.drives[2]),
    };

    private state: ControllerState;

    /** Drive off timeout id or null. */
    private offTimeout: number | null = null;
    /** Current drive object. Must only be set by `updateActiveDrive()`. */
    private curDrive: Drive;
    /** Current driver object. Must only be set by `updateAcivetDrive()`. */
    private curDriver: DiskDriver;

    private worker: Worker;

    /** Builds a new Disk ][ card. */
    constructor(
        private io: Apple2IO,
        private callbacks: Callbacks,
        private sectors: SupportedSectors = 16
    ) {
        this.debug('Disk ][');

        this.state = {
            sectors,
            bus: 0,
            latch: 0,
            driveNo: 1,
            on: false,
            q6: false,
            q7: false,
            clock: 0,
            // From the example in UtA2e, p. 9-29, col. 1, para. 1., this is
            // essentially the start of the sequencer loop and produces
            // correctly synced nibbles immediately.  Starting at state 0
            // would introduce a spurrious 1 in the latch at the beginning,
            // which requires reading several more sync bytes to sync up.
            state: 2,
        };

        this.updateActiveDrive();

        this.initWorker();
    }

    /** Updates the active drive based on the controller state. */
    private updateActiveDrive() {
        this.curDrive = this.drives[this.state.driveNo];
        this.curDriver = this.driver[this.state.driveNo];
    }

    private debug(..._args: unknown[]) {
        // debug(..._args);
    }

    public head(): number {
        return this.curDrive.head;
    }

    /**
     * Sets whether the head positioning stepper motor coil for the given
     * phase is on or off. Normally, the motor must be stepped two phases
     * per track. Half tracks can be written by stepping only once; quarter
     * tracks by activating two neighboring coils at once.
     */
    private setPhase(phase: Phase, on: boolean) {
        // According to Sather, UtA2e, p. 9-12, Drive On/Off and Drive
        // Select:
        //     Turning a drive on ($C089,X) [...]:
        //       1. [...]
        //       5. [...] enables head positioning [...]
        //
        // Therefore do nothing if no drive is on.
        if (!this.state.on) {
            this.debug(`ignoring phase ${phase}${on ? ' on' : ' off'}`);
            return;
        }

        this.debug(`phase ${phase}${on ? ' on' : ' off'}`);
        if (on) {
            this.curDrive.track += PHASE_DELTA[this.curDrive.phase][phase] * 2;
            this.curDrive.phase = phase;
        }

        this.curDriver.clampTrack();

        // debug(
        //     'Drive', _drive, 'track', toHex(_cur.track >> 2) + '.' + (_cur.track & 0x3),
        //     '(' + toHex(_cur.track) + ')',
        //     '[' + phase + ':' + (on ? 'on' : 'off') + ']');
    }

    private access(off: byte, val?: byte) {
        const state = this.state;
        let result = 0;
        const readMode = val === undefined;

        switch (off & 0x8f) {
            case LOC.PHASE0OFF: // 0x00
                this.setPhase(0, false);
                break;
            case LOC.PHASE0ON: // 0x01
                this.setPhase(0, true);
                break;
            case LOC.PHASE1OFF: // 0x02
                this.setPhase(1, false);
                break;
            case LOC.PHASE1ON: // 0x03
                this.setPhase(1, true);
                break;
            case LOC.PHASE2OFF: // 0x04
                this.setPhase(2, false);
                break;
            case LOC.PHASE2ON: // 0x05
                this.setPhase(2, true);
                break;
            case LOC.PHASE3OFF: // 0x06
                this.setPhase(3, false);
                break;
            case LOC.PHASE3ON: // 0x07
                this.setPhase(3, true);
                break;

            case LOC.DRIVEOFF: // 0x08
                if (!this.offTimeout) {
                    if (state.on) {
                        // TODO(flan): This is fragile because it relies on
                        // wall-clock time instead of emulator time.
                        this.offTimeout = window.setTimeout(() => {
                            this.debug('Drive Off');
                            state.on = false;
                            this.callbacks.driveLight(state.driveNo, false);
                            this.curDriver.onDriveOff();
                        }, 1000);
                    }
                }
                break;
            case LOC.DRIVEON: // 0x09
                if (this.offTimeout) {
                    // TODO(flan): Fragile—see above
                    window.clearTimeout(this.offTimeout);
                    this.offTimeout = null;
                }
                if (!state.on) {
                    this.debug('Drive On');
                    state.on = true;
                    this.callbacks.driveLight(state.driveNo, true);
                    this.curDriver.onDriveOn();
                }
                break;

            case LOC.DRIVE1: // 0x0a
                this.debug('Disk 1');
                state.driveNo = 1;
                this.updateActiveDrive();
                if (state.on) {
                    this.callbacks.driveLight(2, false);
                    this.callbacks.driveLight(1, true);
                }
                break;
            case LOC.DRIVE2: // 0x0b
                this.debug('Disk 2');
                state.driveNo = 2;
                this.updateActiveDrive();
                if (state.on) {
                    this.callbacks.driveLight(1, false);
                    this.callbacks.driveLight(2, true);
                }
                break;

            case LOC.DRIVEREAD: // 0x0c (Q6L) Shift
                state.q6 = false;
                this.curDriver.onQ6Low();
                break;

            case LOC.DRIVEWRITE: // 0x0d (Q6H) LOAD
                state.q6 = true;
                this.curDriver.onQ6High(readMode);
                break;

            case LOC.DRIVEREADMODE: // 0x0e (Q7L)
                this.debug('Read Mode');
                state.q7 = false;
                break;
            case LOC.DRIVEWRITEMODE: // 0x0f (Q7H)
                this.debug('Write Mode');
                state.q7 = true;
                break;

            default:
                break;
        }

        this.tick();

        if (readMode) {
            // According to UtAIIe, p. 9-13 to 9-14, any even address can be
            // used to read the data register onto the CPU bus, although some
            // also cause conflicts with the disk controller commands.
            if ((off & 0x01) === 0) {
                result = state.latch;
            } else {
                result = 0;
            }
        } else {
            // It's not explicitly stated, but writes to any address set the
            // data register.
            state.bus = val;
        }

        return result;
    }

    private updateDirty(driveNo: DriveNumber, dirty: boolean) {
        this.drives[driveNo].dirty = dirty;
        if (this.callbacks.dirty) {
            this.callbacks.dirty(driveNo, dirty);
        }
    }

    ioSwitch(off: byte, val?: byte) {
        return this.access(off, val);
    }

    read(_page: byte, off: byte) {
        return BOOTSTRAP_ROM[this.sectors][off];
    }

    write() {
        // not writable
    }

    reset() {
        const state = this.state;
        if (state.on) {
            this.callbacks.driveLight(state.driveNo, false);
            state.q7 = false;
            state.on = false;
            state.driveNo = 1;
        }
        this.updateActiveDrive();
    }

    tick() {
        this.curDriver.tick();
    }

    private getDriveState(driveNo: DriveNumber): DriveState {
        const curDrive = this.drives[driveNo];
        const curDisk = this.disks[driveNo];
        const curDriver = this.driver[driveNo];
        const { readOnly, track, head, phase, dirty } = curDrive;
        return {
            disk: getDiskState(curDisk),
            driver: curDriver.getState(),
            readOnly,
            track,
            head,
            phase,
            dirty,
        };
    }

    getState(): State {
        const result = {
            drives: [] as DriveState[],
            controllerState: { ...this.state },
        };
        result.drives[1] = this.getDriveState(1);
        result.drives[2] = this.getDriveState(2);

        return result;
    }

    private setDriveState(driveNo: DriveNumber, state: DriveState) {
        const { track, head, phase, readOnly, dirty } = state;
        this.drives[driveNo] = {
            track,
            head,
            phase,
            readOnly,
            dirty,
        };
        const disk = getDiskState(state.disk);
        this.setDiskInternal(driveNo, disk);
        this.driver[driveNo].setState(state.driver);
    }

    setState(state: State) {
        this.state = { ...state.controllerState };
        for (const d of DRIVE_NUMBERS) {
            this.setDriveState(d, state.drives[d]);
            const { name, side } = state.drives[d].disk.metadata;
            const { dirty } = state.drives[d];
            this.callbacks.label(d, name, side);
            this.callbacks.driveLight(d, this.state.on);
            this.callbacks.dirty(d, dirty);
        }
        this.updateActiveDrive();
    }

    getMetadata(driveNo: DriveNumber) {
        const { track, head, phase, readOnly, dirty } = this.drives[driveNo];
        return {
            track,
            head,
            phase,
            readOnly,
            dirty,
        };
    }

    /** Reads the given track and physical sector. */
    rwts(driveNo: DriveNumber, track: byte, sector: byte) {
        const curDisk = this.disks[driveNo];
        if (!isNibbleDisk(curDisk)) {
            throw new Error("Can't read WOZ disks");
        }
        return readSector(curDisk, track, sector);
    }

    /** Sets the data for `drive` from `disk`, which is expected to be JSON. */
    // TODO(flan): This implementation is not very safe.
    setDisk(driveNo: DriveNumber, jsonDisk: JSONDisk) {
        if (this.worker) {
            const message: FormatWorkerMessage = {
                type: PROCESS_JSON_DISK,
                payload: {
                    driveNo: driveNo,
                    jsonDisk,
                },
            };
            this.worker.postMessage(message);
            return true;
        } else {
            const disk = createDiskFromJsonDisk(jsonDisk);
            if (disk) {
                this.insertDisk(driveNo, disk);
                return true;
            }
        }
        return false;
    }

    getJSON(driveNo: DriveNumber, pretty: boolean = false) {
        const curDisk = this.disks[driveNo];
        if (!isNibbleDisk(curDisk)) {
            throw new Error("Can't save WOZ disks to JSON");
        }
        return jsonEncode(curDisk, pretty);
    }

    setJSON(driveNo: DriveNumber, json: string) {
        if (this.worker) {
            const message: FormatWorkerMessage = {
                type: PROCESS_JSON,
                payload: {
                    driveNo: driveNo,
                    json,
                },
            };
            this.worker.postMessage(message);
        } else {
            const disk = jsonDecode(json);
            this.insertDisk(driveNo, disk);
        }
        return true;
    }

    setBinary(
        driveNo: DriveNumber,
        name: string,
        fmt: FloppyFormat,
        rawData: ArrayBuffer
    ) {
        const readOnly = false;
        const volume = 254;
        const options = {
            name,
            rawData,
            readOnly,
            volume,
        };

        if (this.worker) {
            const message: FormatWorkerMessage = {
                type: PROCESS_BINARY,
                payload: {
                    driveNo: driveNo,
                    fmt,
                    options,
                },
            };
            this.worker.postMessage(message);

            return true;
        } else {
            const disk = createDisk(fmt, options);
            if (disk) {
                this.insertDisk(driveNo, disk);
                return true;
            }
        }
        return false;
    }

    initWorker() {
        if (!window.Worker) {
            return;
        }

        try {
            this.worker = new Worker('dist/format_worker.bundle.js');

            this.worker.addEventListener(
                'message',
                (message: MessageEvent<FormatWorkerResponse>) => {
                    const { data } = message;
                    switch (data.type) {
                        case DISK_PROCESSED:
                            {
                                const { driveNo: drive, disk } = data.payload;
                                if (disk) {
                                    this.insertDisk(drive, disk);
                                }
                            }
                            break;
                    }
                }
            );
        } catch (e: unknown) {
            console.error(e);
        }
    }

    private setDiskInternal(driveNo: DriveNumber, disk: FloppyDisk) {
        this.disks[driveNo] = disk;
        if (isNoFloppyDisk(disk)) {
            this.driver[driveNo] = new EmptyDriver(this.drives[driveNo]);
        } else if (isNibbleDisk(disk)) {
            this.driver[driveNo] = new NibbleDiskDriver(
                driveNo,
                this.drives[driveNo],
                disk,
                this.state,
                () => this.updateDirty(driveNo, true)
            );
        } else if (isWozDisk(disk)) {
            this.driver[driveNo] = new WozDiskDriver(
                driveNo,
                this.drives[driveNo],
                disk,
                this.state,
                () => this.updateDirty(driveNo, true),
                this.io
            );
        } else {
            throw new Error(`Unknown disk format ${disk.encoding}`);
        }
        this.updateActiveDrive();
    }

    private insertDisk(driveNo: DriveNumber, disk: FloppyDisk) {
        this.setDiskInternal(driveNo, disk);
        this.drives[driveNo].head = 0;
        const { name, side } = disk.metadata;
        this.updateDirty(driveNo, this.drives[driveNo].dirty);
        this.callbacks.label(driveNo, name, side);
    }

    /**
     * Returns the binary image of the non-WOZ disk in the given drive.
     * For WOZ disks, this method returns `null`. If the `ext` parameter
     * is supplied, the returned data will match that format or an error
     * will be thrown. If the `ext` parameter is not supplied, the
     * original image format for the disk in the drive will be used. If
     * the current data on the disk is no longer readable in that format,
     * an error will be thrown. Using `ext == 'nib'` will always return
     * an image.
     */
    getBinary(
        driveNo: DriveNumber,
        ext?: Exclude<NibbleFormat, 'woz'>
    ): MassStorageData | null {
        const curDisk = this.disks[driveNo];
        if (!isNibbleDisk(curDisk)) {
            return null;
        }
        const { format, readOnly, tracks, volume } = curDisk;
        const { name } = curDisk.metadata;
        const len =
            format === 'nib'
                ? tracks.reduce((acc, track) => acc + track.length, 0)
                : this.sectors * tracks.length * 256;
        const data = new Uint8Array(len);

        ext = ext ?? format;
        let idx = 0;
        for (let t = 0; t < tracks.length; t++) {
            if (ext === 'nib') {
                data.set(tracks[t], idx);
                idx += tracks[t].length;
            } else {
                let maxSector: SupportedSectors;
                let sectorMap: typeof _PO | typeof _DO | typeof _D13O;
                if (ext === 'd13') {
                    maxSector = 13;
                    sectorMap = _D13O;
                } else {
                    maxSector = 16;
                    sectorMap = format === 'po' ? _PO : _DO;
                }

                for (let s = 0; s < maxSector; s++) {
                    const _s = sectorMap[s];
                    const sector = readSector(
                        { ...curDisk, format: ext },
                        t,
                        _s
                    );
                    data.set(sector, idx);
                    idx += sector.length;
                }
            }
        }

        return {
            ext,
            metadata: { name },
            data: data.buffer,
            readOnly,
            volume,
        };
    }

    // TODO(flan): Does not work with WOZ or D13 disks
    getBase64(driveNo: DriveNumber) {
        const curDisk = this.disks[driveNo];
        if (!isNibbleDisk(curDisk)) {
            return null;
        }
        const data: string[][] | string[] = [];
        for (let t = 0; t < curDisk.tracks.length; t++) {
            if (isNibbleDisk(curDisk)) {
                data[t] = base64_encode(curDisk.tracks[t]);
            } else {
                const track: string[] = [];
                for (let s = 0; s < 0x10; s++) {
                    track[s] = base64_encode(readSector(curDisk, t, s));
                }
                data[t] = track;
            }
        }
        return data;
    }
}
