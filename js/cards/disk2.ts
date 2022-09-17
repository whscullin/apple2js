import { base64_encode } from '../base64';
import type {
    byte,
    Card,
    nibble,
    ReadonlyUint8Array,
} from '../types';

import {
    FormatWorkerMessage,
    FormatWorkerResponse,
    NibbleFormat,
    DISK_PROCESSED,
    DRIVE_NUMBERS,
    DriveNumber,
    JSONDisk,
    PROCESS_BINARY,
    PROCESS_JSON_DISK,
    PROCESS_JSON,
    MassStorage,
    MassStorageData,
    SupportedSectors,
    FloppyDisk,
    FloppyFormat,
    WozDisk,
    NibbleDisk,
    isNibbleDisk,
    isWozDisk,
    NoFloppyDisk,
    isNoFloppyDisk,
    NO_DISK,
} from '../formats/types';

import {
    createDisk,
    createDiskFromJsonDisk
} from '../formats/create_disk';

import { toHex } from '../util';
import { jsonDecode, jsonEncode, readSector } from '../formats/format_utils';

import { BOOTSTRAP_ROM_16, BOOTSTRAP_ROM_13 } from '../roms/cards/disk2';
import Apple2IO from '../apple2io';

/** Softswitch locations */
const LOC = {
    // Disk II Controller Commands
    // See Understanding the Apple IIe, Table 9.1
    PHASE0OFF: 0x80,     // Q0L: Phase 0 OFF
    PHASE0ON: 0x81,      // Q0H: Phase 0 ON
    PHASE1OFF: 0x82,     // Q1L: Phase 1 OFF
    PHASE1ON: 0x83,      // Q1H: Phase 1 ON
    PHASE2OFF: 0x84,     // Q2L: Phase 2 OFF
    PHASE2ON: 0x85,      // Q2H: Phase 2 ON
    PHASE3OFF: 0x86,     // Q3L: Phase 3 OFF
    PHASE3ON: 0x87,      // Q3H: Phase 3 ON

    DRIVEOFF: 0x88,      // Q4L: Drives OFF
    DRIVEON: 0x89,       // Q4H: Selected drive ON
    DRIVE1: 0x8A,        // Q5L: Select drive 1
    DRIVE2: 0x8B,        // Q5H: Select drive 2
    DRIVEREAD: 0x8C,     // Q6L: Shift while writing; read data
    DRIVEWRITE: 0x8D,    // Q6H: Load while writing; read write protect
    DRIVEREADMODE: 0x8E, // Q7L: Read
    DRIVEWRITEMODE: 0x8F // Q7H: Write
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
const SEQUENCER_ROM: Record<SupportedSectors, ReadonlyArray<byte>> = {
    13: SEQUENCER_ROM_13,
    16: SEQUENCER_ROM_16,
};

/** Contents of the P5 ROM at 0xCnXX. */
const BOOTSTRAP_ROM: Record<SupportedSectors, ReadonlyUint8Array> = {
    13: BOOTSTRAP_ROM_13,
    16: BOOTSTRAP_ROM_16,
};

type LssClockCycle = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Phase = 0 | 1 | 2 | 3;

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
    [1, -2, -1, 0]
] as const;

/**
 * State of the controller.
 */
 interface ControllerState {
    /** Sectors supported by the controller. */
    sectors: SupportedSectors;

    /** Is the active drive powered on? */
    on: boolean;

    /** The active drive. */
    drive: DriveNumber;

    /** The 8-cycle LSS clock. */
    clock: LssClockCycle;
    /** Current state of the Logic State Sequencer. */
    state: nibble;

    /** Q6 (Shift/Load) */
    q6: boolean;
    /** Q7 (Read/Write) */
    q7: boolean;

    /** Last data from the disk drive. */
    latch: byte;
    /** Last data written by the CPU to card softswitch 0x8D. */
    bus: byte;
}

/** Callbacks triggered by events of the drive or controller. */
export interface Callbacks {
    /** Called when a drive turns on or off. */
    driveLight: (drive: DriveNumber, on: boolean) => void;
    /**
     * Called when a disk has been written to. For performance and integrity,
     * this is only called when the drive stops spinning or is removed from
     * the drive.
     */
    dirty: (drive: DriveNumber, dirty: boolean) => void;
    /** Called when a disk is inserted or removed from the drive. */
    label: (drive: DriveNumber, name?: string, side?: string) => void;
}

/** Common information for Nibble and WOZ disks. */
interface Drive {
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

interface DriveState {
    disk: FloppyDisk;
    readOnly: boolean;
    track: byte;
    head: byte;
    phase: Phase;
    dirty: boolean;
}

/** State of the controller for saving/restoring. */
// TODO(flan): It's unclear whether reusing ControllerState here is a good idea.
interface State {
    drives: DriveState[];
    skip: number;
    controllerState: ControllerState;
}

function getDiskState(disk: NoFloppyDisk): NoFloppyDisk;
function getDiskState(disk: NibbleDisk): NibbleDisk;
function getDiskState(disk: WozDisk): WozDisk;
function getDiskState(disk: FloppyDisk): FloppyDisk;
function getDiskState(disk: FloppyDisk): FloppyDisk {
    if (isNoFloppyDisk(disk)) {
        const { encoding, metadata, readOnly } = disk;
        return {
            encoding,
            metadata: {...metadata},
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
        const { format, encoding, metadata, readOnly, trackMap, rawTracks } = disk;
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
        1: {   // Drive 1
            track: 0,
            head: 0,
            phase: 0,
            readOnly: false,
            dirty: false,
        },
        2: {   // Drive 2
            track: 0,
            head: 0,
            phase: 0,
            readOnly: false,
            dirty: false,
        }
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
        }
    };

    private state: ControllerState;

    /**
     * When `1`, the next nibble will be available for read; when `0`,
     * the card is pretending to wait for data to be shifted in by the
     * sequencer.
     */
    private skip = 0;
    /** Drive off timeout id or null. */
    private offTimeout: number | null = null;
    /** Current drive object. Must only be set by `updateActiveDrive()`. */
    private curDrive: Drive;
    /** Current disk object. Must only be set by `updateActiveDrive()`. */
    private curDisk: FloppyDisk;

    /** Nibbles read this on cycle */
    private nibbleCount = 0;

    /** Current CPU cycle count. */
    private lastCycles = 0;
    /**
     * Number of zeros read in a row. The Disk ][ can only read two zeros in a
     * row reliably; above that and the drive starts reporting garbage.  See
     * "Freaking Out Like a MC3470" in the WOZ spec.
     */
    private zeros = 0;

    private worker: Worker;

    /** Builds a new Disk ][ card. */
    constructor(private io: Apple2IO, private callbacks: Callbacks, private sectors: SupportedSectors = 16) {
        this.debug('Disk ][');

        this.lastCycles = this.io.cycles();
        this.state = {
            sectors,
            bus: 0,
            latch: 0,
            drive: 1,
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
        this.curDrive = this.drives[this.state.drive];
        this.curDisk = this.disks[this.state.drive];
    }

    private debug(..._args: unknown[]) {
        // debug(..._args);
    }

    public head(): number {
        return this.curDrive.head;
    }

    /**
     * Spin the disk under the read/write head for WOZ images.
     *
     * This implementation emulates every clock cycle of the 2 MHz
     * sequencer since the last time it was called in order to
     * determine the current state. Because this is called on
     * every access to the softswitches, the data in the latch
     * will be correct on every read.
     *
     * The emulation of the disk makes a few simplifying assumptions:
     *
     * *   The motor turns on instantly.
     * *   The head moves tracks instantly.
     * *   The length (in bits) of each track of the WOZ image
     *     represents one full rotation of the disk and that each
     *     bit is evenly spaced.
     * *   Writing will not change the track length. This means
     *     that short tracks stay short.
     * *   The read head picks up the next bit when the sequencer
     *     clock === 4.
     * *   Head position X on track T is equivalent to head position
     *     X on track T′. (This is not the recommendation in the WOZ
     *     spec.)
     * *   Unspecified tracks contain a single zero bit. (A very
     *     short track, indeed!)
     * *   Two zero bits are sufficient to cause the MC3470 to freak
     *     out. When freaking out, it returns 0 and 1 with equal
     *     probability.
     * *   Any softswitch changes happen before `moveHead`. This is
     *     important because it means that if the clock is ever
     *     advanced more than one cycle between calls, the
     *     softswitch changes will appear to happen at the very
     *     beginning, not just before the last cycle.
     */
    private moveHead() {
        // TODO(flan): Short-circuit if the drive is not on.
        const cycles = this.io.cycles();

        // Spin the disk the number of elapsed cycles since last call
        let workCycles = (cycles - this.lastCycles) * 2;
        this.lastCycles = cycles;

        if (!isWozDisk(this.curDisk)) {
            return;
        }
        const track =
            this.curDisk.rawTracks[this.curDisk.trackMap[this.curDrive.track]] || [0];
        
        const state = this.state;

        while (workCycles-- > 0) {
            let pulse: number = 0;
            if (state.clock === 4) {
                pulse = track[this.curDrive.head];
                if (!pulse) {
                    // More than 2 zeros can not be read reliably.
                    if (++this.zeros > 2) {
                        pulse = Math.random() >= 0.5 ? 1 : 0;
                    }
                } else {
                    this.zeros = 0;
                }
            }

            let idx = 0;
            idx |= pulse ? 0x00 : 0x01;
            idx |= state.latch & 0x80 ? 0x02 : 0x00;
            idx |= state.q6 ? 0x04 : 0x00;
            idx |= state.q7 ? 0x08 : 0x00;
            idx |= state.state << 4;

            const command = SEQUENCER_ROM[this.sectors][idx];

            this.debug(`clock: ${state.clock} state: ${toHex(state.state)} pulse: ${pulse} command: ${toHex(command)} q6: ${state.q6} latch: ${toHex(state.latch)}`);

            switch (command & 0xf) {
                case 0x0: // CLR
                    state.latch = 0;
                    break;
                case 0x8: // NOP
                    break;
                case 0x9: // SL0
                    state.latch = (state.latch << 1) & 0xff;
                    break;
                case 0xA: // SR
                    state.latch >>= 1;
                    if (this.curDrive.readOnly) {
                        state.latch |= 0x80;
                    }
                    break;
                case 0xB: // LD
                    state.latch = state.bus;
                    this.debug('Loading', toHex(state.latch), 'from bus');
                    break;
                case 0xD: // SL1
                    state.latch = ((state.latch << 1) | 0x01) & 0xff;
                    break;
                default:
                    this.debug(`unknown command: ${toHex(command & 0xf)}`);
            }
            state.state = (command >> 4 & 0xF) as nibble;

            if (state.clock === 4) {
                if (state.on) {
                    if (state.q7) {
                        track[this.curDrive.head] = state.state & 0x8 ? 0x01 : 0x00;
                        this.debug('Wrote', state.state & 0x8 ? 0x01 : 0x00);
                    }

                    if (++this.curDrive.head >= track.length) {
                        this.curDrive.head = 0;
                    }
                }
            }

            if (++state.clock > 7) {
                state.clock = 0;
            }
        }
    }

    // Only called for non-WOZ disks
    private readWriteNext() {
        if (!isNibbleDisk(this.curDisk)) {
            return;
        }
        const state = this.state;
        if (state.on && (this.skip || state.q7)) {
            const track = this.curDisk.tracks[this.curDrive.track >> 2];
            if (track && track.length) {
                if (this.curDrive.head >= track.length) {
                    this.curDrive.head = 0;
                }

                if (state.q7) {
                    if (!this.curDrive.readOnly) {
                        track[this.curDrive.head] = state.bus;
                        if (!this.curDrive.dirty) {
                            this.updateDirty(state.drive, true);
                        }
                    }
                } else {
                    state.latch = track[this.curDrive.head];
                }

                ++this.curDrive.head;
            }
        } else {
            state.latch = 0;
        }
        this.skip = (++this.skip % 2);
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

        // The emulator clamps the track to the valid track range available
        // in the image, but real Disk II drives can seek past track 34 by
        // at least a half track, usually a full track. Some 3rd party
        // drives can seek to track 39.
        const maxTrack = isNibbleDisk(this.curDisk)
            ? this.curDisk.tracks.length * 4 - 1
            : (isWozDisk(this.curDisk)
                ? this.curDisk.trackMap.length - 1 
                : 0);
        if (this.curDrive.track > maxTrack) {
            this.curDrive.track = maxTrack;
        }
        if (this.curDrive.track < 0x0) {
            this.curDrive.track = 0x0;
        }

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
            case LOC.PHASE3ON:  // 0x07
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
                            this.callbacks.driveLight(state.drive, false);
                            this.debug('nibbles read', this.nibbleCount);
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
                    this.nibbleCount = 0;
                    state.on = true;
                    this.lastCycles = this.io.cycles();
                    this.callbacks.driveLight(state.drive, true);
                }
                break;

            case LOC.DRIVE1:  // 0x0a
                this.debug('Disk 1');
                state.drive = 1;
                this.updateActiveDrive();
                if (state.on) {
                    this.callbacks.driveLight(2, false);
                    this.callbacks.driveLight(1, true);
                }
                break;
            case LOC.DRIVE2:  // 0x0b
                this.debug('Disk 2');
                state.drive = 2;
                this.updateActiveDrive();
                if (state.on) {
                    this.callbacks.driveLight(1, false);
                    this.callbacks.driveLight(2, true);
                }
                break;

            case LOC.DRIVEREAD: // 0x0c (Q6L) Shift
                state.q6 = false;
                if (state.q7) {
                    this.debug('clearing _q6/SHIFT');
                }
                if (isNibbleDisk(this.curDisk)) {
                    this.readWriteNext();
                }
                break;

            case LOC.DRIVEWRITE: // 0x0d (Q6H) LOAD
                state.q6 = true;
                if (state.q7) {
                    this.debug('setting _q6/LOAD');
                }
                if (isNibbleDisk(this.curDisk)) {
                    if (readMode && !state.q7) {
                        if (this.curDrive.readOnly) {
                            state.latch = 0xff;
                            this.debug('Setting readOnly');
                        } else {
                            state.latch = state.latch >> 1;
                            this.debug('Clearing readOnly');
                        }
                    }
                }
                break;

            case LOC.DRIVEREADMODE:  // 0x0e (Q7L)
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

        this.moveHead();

        if (readMode) {
            // According to UtAIIe, p. 9-13 to 9-14, any even address can be
            // used to read the data register onto the CPU bus, although some
            // also cause conflicts with the disk controller commands.
            if ((off & 0x01) === 0) {
                result = state.latch;
                if (result & 0x80) {
                    this.nibbleCount++;
                }
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

    private updateDirty(drive: DriveNumber, dirty: boolean) {
        this.drives[drive].dirty = dirty;
        if (this.callbacks.dirty) {
            this.callbacks.dirty(drive, dirty);
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
            this.callbacks.driveLight(state.drive, false);
            state.q7 = false;
            state.on = false;
            state.drive = 1;
        }
        this.updateActiveDrive();
    }

    tick() {
        this.moveHead();
    }

    private getDriveState(drive: DriveNumber): DriveState {
        const curDrive = this.drives[drive];
        const curDisk = this.disks[drive];
        const { readOnly, track, head, phase, dirty } = curDrive;
        return {
            disk: getDiskState(curDisk),
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
            skip: this.skip,
            controllerState: { ...this.state },
        };
        result.drives[1] = this.getDriveState(1);
        result.drives[2] = this.getDriveState(2);

        return result;
    }

    private setDriveState(drive: DriveNumber, state: DriveState) {
        const { track, head, phase, readOnly, dirty } = state;
        this.drives[drive] = {
            track,
            head,
            phase,
            readOnly,
            dirty,
        };
        this.disks[drive] = getDiskState(state.disk);
    }
    

    setState(state: State) {
        this.skip = state.skip;
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

    // TODO(flan): Does not work on WOZ disks
    rwts(drive: DriveNumber, track: byte, sector: byte) {
        const curDisk = this.disks[drive];
        if (!isNibbleDisk(curDisk)) {
            throw new Error('Can\'t read WOZ disks');
        }
        return readSector(curDisk, track, sector);
    }

    /** Sets the data for `drive` from `disk`, which is expected to be JSON. */
    // TODO(flan): This implementation is not very safe.
    setDisk(drive: DriveNumber, jsonDisk: JSONDisk) {
        if (this.worker) {
            const message: FormatWorkerMessage = {
                type: PROCESS_JSON_DISK,
                payload: {
                    drive,
                    jsonDisk
                },
            };
            this.worker.postMessage(message);
            return true;
        } else {
            const disk = createDiskFromJsonDisk(jsonDisk);
            if (disk) {
                this.insertDisk(drive, disk);
                return true;
            }
        }
        return false;
    }

    getJSON(drive: DriveNumber, pretty: boolean = false) {
        const curDisk = this.disks[drive];
        if (!isNibbleDisk(curDisk)) {
            throw new Error('Can\'t save WOZ disks to JSON');
        }
        return jsonEncode(curDisk, pretty);
    }

    setJSON(drive: DriveNumber, json: string) {
        if (this.worker) {
            const message: FormatWorkerMessage = {
                type: PROCESS_JSON,
                payload: {
                    drive,
                    json
                },
            };
            this.worker.postMessage(message);
        } else {
            const disk = jsonDecode(json);
            this.insertDisk(drive, disk);
        }
        return true;
    }

    setBinary(drive: DriveNumber, name: string, fmt: FloppyFormat, rawData: ArrayBuffer) {
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
                    drive,
                    fmt,
                    options,
                }
            };
            this.worker.postMessage(message);

            return true;
        } else {
            const disk = createDisk(fmt, options);
            if (disk) {
                this.insertDisk(drive, disk);
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

            this.worker.addEventListener('message', (message: MessageEvent<FormatWorkerResponse>) => {
                const { data } = message;
                switch (data.type) {
                    case DISK_PROCESSED:
                        {
                            const { drive, disk } = data.payload;
                            if (disk) {
                                this.insertDisk(drive, disk);
                            }
                        }
                        break;
                }
            });
        } catch (e: unknown) {
            console.error(e);
        }
    }

    private insertDisk(drive: DriveNumber, disk: FloppyDisk) {
        this.disks[drive] = disk;
        this.drives[drive].head = 0;
        this.updateActiveDrive();
        const { name, side } = disk.metadata;
        this.updateDirty(drive, true);
        this.callbacks.label(drive, name, side);
    }

    // TODO(flan): Does not work with WOZ or D13 disks
    getBinary(drive: DriveNumber, ext?: Exclude<NibbleFormat, 'woz' | 'd13'>): MassStorageData | null {
        const curDisk = this.disks[drive];
        if (!isNibbleDisk(curDisk)) {
            return null;
        }
        const { format, readOnly, tracks, volume } = curDisk;
        const { name } = curDisk.metadata;
        const len = format === 'nib' ?
            tracks.reduce((acc, track) => acc + track.length, 0) :
            this.sectors * tracks.length * 256;
        const data = new Uint8Array(len);

        const extension = ext ?? format;
        let idx = 0;
        for (let t = 0; t < tracks.length; t++) {
            if (ext === 'nib') {
                data.set(tracks[t], idx);
                idx += tracks[t].length;
            } else {
                for (let s = 0; s < 0x10; s++) {
                    const sector = readSector({ ...curDisk, format: extension }, t, s);
                    data.set(sector, idx);
                    idx += sector.length;
                }
            }
        }

        return {
            ext: extension,
            metadata: { name },
            data: data.buffer,
            readOnly,
            volume,
        };
    }

    // TODO(flan): Does not work with WOZ or D13 disks
    getBase64(drive: DriveNumber) {
        const curDisk = this.disks[drive];
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
