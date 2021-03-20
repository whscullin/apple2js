/* Copyright 2010-2019 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

import { base64_decode, base64_encode} from '../base64';
import { bit, byte, Card, DiskFormat, MemberOf, memory, nibble, rom } from '../types';
import { debug, toHex } from '../util';
import { Disk, JSONDisk, jsonDecode, jsonEncode, readSector } from '../formats/format_utils';

import { BOOTSTRAP_ROM_16, BOOTSTRAP_ROM_13 } from '../roms/cards/disk2';

import _2MG from '../formats/2mg';
import D13 from '../formats/d13';
import DOS from '../formats/do';
import ProDOS from '../formats/po';
import Woz from '../formats/woz';
import Nibble from '../formats/nib';
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
 * one finds that the SEEK routine on line 4831 of `appdos31.lst`. It uses
 * `ONTABLE` and `OFFTABLE` (each 12 bytes) to know exactly how many
 * microseconds to power on/off each coil as the head accelerates. At the end,
 * the final coil is left powered on 9.5 milliseconds to ensure the head has
 * settled.
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

export const DRIVE_NUMBERS = [1, 2] as const;
export type DriveNumber = MemberOf<typeof DRIVE_NUMBERS>;

export interface Callbacks {
    driveLight: (drive: DriveNumber, on: boolean) => void;
    dirty: (drive: DriveNumber, dirty: boolean) => void;
    label: (drive: DriveNumber, name: string) => void;
}

/** Common information for Nibble and WOZ disks. */
interface BaseDrive {
    /** Current disk format. */
    format: DiskFormat,
    /** Current disk volume number. */
    volume: byte,
    /** Displayed disk name */
    name: string,
    /** Quarter track position of read/write head. */
    track: byte,
    /** Position of the head on the track. */
    head: byte,
    /** Current active coil in the head stepper motor. */
    phase: Phase,
    /** Whether the drive write protect is on. */
    readOnly: boolean,
    /** Whether the drive has been written to since it was loaded. */
    dirty: boolean,
}

/** WOZ format track data from https://applesaucefdc.com/woz/reference2/. */
interface WozDrive extends BaseDrive {
    /** Maps quarter tracks to data in rawTracks; `0xFF` = random garbage. */
    trackMap: byte[];
    /** Unique track bitstreams. The index is arbitrary; it is NOT the track number. */
    rawTracks: bit[][];
}

/** Nibble format track data. */
interface NibbleDrive extends BaseDrive {
    /** Nibble data. The index is the track number. */
    tracks: memory[];
}

type Drive = WozDrive | NibbleDrive;

function isNibbleDrive(drive: Drive): drive is NibbleDrive {
    return 'tracks' in drive;
}

// Does not support WOZ disks
interface DriveState {
    format: DiskFormat,
    volume: byte,
    name: string,
    tracks: memory[],
    track: byte,
    head: byte,
    phase: Phase,
    readOnly: boolean,
    dirty: boolean,
}

interface State {
    drives: DriveState[];
    skip: number;
    latch: number;
    writeMode: boolean;
    on: boolean;
    drive: DriveNumber;
}

// TODO(flan): Does not work for WOZ disks
function getDriveState(drive: Drive): DriveState {
    const result: DriveState = {
        format: drive.format,
        volume: drive.volume,
        name: drive.name,
        tracks: [],
        track: drive.track,
        head: drive.head,
        phase: drive.phase,
        readOnly: drive.readOnly,
        dirty: drive.dirty
    };
    if (!isNibbleDrive(drive)) {
        throw Error('No tracks.');
    }
    for (let idx = 0; idx < drive.tracks.length; idx++) {
        result.tracks.push(new Uint8Array(drive.tracks[idx]));
    }
    return result;
}

// TODO(flan): Does not work for WOZ disks
function setDriveState(state: DriveState) {
    const result: Drive = {
        format: state.format,
        volume: state.volume,
        name: state.name,
        tracks: [] as memory[],
        track: state.track,
        head: state.head,
        phase: state.phase,
        readOnly: state.readOnly,
        dirty: state.dirty
    };
    for (let idx = 0; idx < state.tracks.length; idx++) {
        result.tracks!.push(new Uint8Array(state.tracks[idx]));
    }

    return result;
}

/**
 * Emulates the 16-sector and 13-sector versions of the Disk ][ drive and controller.
 */
export default class DiskII implements Card {

    private drives: Drive[] = [
        {   // Drive 1
            format: 'dsk',
            volume: 254,
            name: 'Disk 1',
            tracks: [],
            track: 0,
            head: 0,
            phase: 0,
            readOnly: false,
            dirty: false
        },
        {   // Drive 2
            format: 'dsk',
            volume: 254,
            name: 'Disk 2',
            tracks: [],
            track: 0,
            head: 0,
            phase: 0,
            readOnly: false,
            dirty: false
        }];

    private skip = 0;
    /** Last data written by the CPU to card softswitch 0x8D. */
    private bus = 0;
    /** Drive data register. */
    private latch = 0;
    /** Drive off timeout id or null. */
    private offTimeout: number | null = null;
    /** Q6 (Shift/Load): Used by WOZ disks. */
    private q6 = 0;
    /** Q7 (Read/Write): Used by WOZ disks. */
    private q7: boolean = false;
    /** Q7 (Read/Write): Used by Nibble disks. */
    private writeMode = false;
    /** Whether the selected drive is on. */
    private on = false;
    /** Current drive number (1, 2). */
    private drive: DriveNumber = 1;
    /** Current drive object. */
    private cur = this.drives[this.drive - 1];

    /** Q0-Q3: Coil states. */
    private q = [false, false, false, false];

    /** The 8-cycle LSS clock. */
    private clock: LssClockCycle = 0;
    /** Current CPU cycle count. */
    private lastCycles = 0;
    /** Current state of the Logic State Sequencer. */
    private state: nibble = 0;
    /**
     * Number of zeros read in a row. The Disk ][ can only read two zeros in a
     * row reliably; above that and the drive starts reporting garbage.  See
     * "Freaking Out Like a MC3470" in the WOZ spec.
     */
    private zeros = 0;

    /** Contents of the P5 ROM at 0xCnXX. */
    private bootstrapRom: rom;
    /** Contents of the P6 ROM. */
    private sequencerRom: typeof SEQUENCER_ROM_16 | typeof SEQUENCER_ROM_13;

    /** Builds a new Disk ][ card. */
    constructor(private io: Apple2IO, private callbacks: Callbacks, private sectors = 16) {
        this.lastCycles = this.io.cycles();
        this.bootstrapRom = this.sectors == 16 ? BOOTSTRAP_ROM_16 : BOOTSTRAP_ROM_13;
        this.sequencerRom = this.sectors == 16 ? SEQUENCER_ROM_16 : SEQUENCER_ROM_13;

        this.init();
    }

    private debug(..._args: any[]) {
        // debug.apply(this, arguments);
    }

    private init() {
        this.debug('Disk ][');
    }

    // Only used for WOZ disks
    private moveHead() {
        if (isNibbleDrive(this.cur)) {
            return;
        }
        const track: bit[] =
            this.cur.rawTracks[this.cur.trackMap[this.cur.track]] || [0];

        const cycles = this.io.cycles();

        // Spin the disk the number of elapsed cycles since last call
        let workCycles = (cycles - this.lastCycles) * 2;
        this.lastCycles = cycles;

        while (workCycles-- > 0) {
            let pulse: bit = 0;
            if (this.clock == 4) {
                pulse = track[this.cur.head];
                if (!pulse) {
                    // More that 2 zeros can not be read reliably.
                    if (++this.zeros > 2) {
                        pulse = Math.random() >= 0.5 ? 1 : 0;
                    }
                } else {
                    this.zeros = 0;
                }
            }

            let idx = 0;
            idx |= pulse ? 0x00 : 0x01;
            idx |= this.latch & 0x80 ? 0x02 : 0x00;
            idx |= this.q6 ? 0x04 : 0x00;
            idx |= this.q7 ? 0x08 : 0x00;
            idx |= this.state << 4;

            const command = this.sequencerRom[idx];

            if (this.on && this.q7) {
                debug('clock:', this.clock, 'command:', toHex(command), 'q6:', this.q6);
            }

            switch (command & 0xf) {
                case 0x0: // CLR
                    this.latch = 0;
                    break;
                case 0x8: // NOP
                    break;
                case 0x9: // SL0
                    this.latch = (this.latch << 1) & 0xff;
                    break;
                case 0xA: // SR
                    this.latch >>= 1;
                    if (this.cur.readOnly) {
                        this.latch |= 0x80;
                    }
                    break;
                case 0xB: // LD
                    this.latch = this.bus;
                    debug('Loading', toHex(this.latch), 'from bus');
                    break;
                case 0xD: // SL1
                    this.latch = ((this.latch << 1) | 0x01) & 0xff;
                    break;
            }
            this.state = (command >> 4 & 0xF) as nibble;

            if (this.clock == 4) {
                if (this.on) {
                    if (this.q7) {
                        track[this.cur.head] = this.state & 0x8 ? 0x01 : 0x00;
                        debug('Wrote', this.state & 0x8 ? 0x01 : 0x00);
                    }

                    if (++this.cur.head >= track.length) {
                        this.cur.head = 0;
                    }
                }
            }

            if (++this.clock > 7) {
                this.clock = 0;
            }
        }
    }

    // Only called for non-WOZ disks
    private readWriteNext() {
        if (!isNibbleDrive(this.cur)) {
            return;
        }
        if (this.on && (this.skip || this.writeMode)) {
            const track = this.cur.tracks![this.cur.track >> 2];
            if (track && track.length) {
                if (this.cur.head >= track.length) {
                    this.cur.head = 0;
                }

                if (this.writeMode) {
                    if (!this.cur.readOnly) {
                        track[this.cur.head] = this.bus;
                        if (!this.cur.dirty) {
                            this.updateDirty(this.drive, true);
                        }
                    }
                } else {
                    this.latch = track[this.cur.head];
                }

                ++this.cur.head;
            }
        } else {
            this.latch = 0;
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
        this.debug('phase ' + phase + (on ? ' on' : ' off'));
        if (on) {
            this.cur.track += PHASE_DELTA[this.cur.phase][phase] * 2;
            this.cur.phase = phase;
        }

        const maxTrack = isNibbleDrive(this.cur)
            ? this.cur.tracks.length * 4 - 1
            : this.cur.trackMap.length - 1;
        if (this.cur.track > maxTrack) {
            this.cur.track = maxTrack;
        }
        if (this.cur.track < 0x0) {
            this.cur.track = 0x0;
        }

        // debug(
        //     'Drive', _drive, 'track', toHex(_cur.track >> 2) + '.' + (_cur.track & 0x3),
        //     '(' + toHex(_cur.track) + ')',
        //     '[' + phase + ':' + (on ? 'on' : 'off') + ']');

        this.q[phase] = on;
    }

    private access(off: byte, val?: byte) {
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
                    if (this.on) {
                        // TODO(flan): This is fragile because it relies on
                        // wall-clock time instead of emulator time.
                        this.offTimeout = window.setTimeout(() => {
                            this.debug('Drive Off');
                            this.on = false;
                            this.callbacks.driveLight(this.drive, false);
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
                if (!this.on) {
                    this.debug('Drive On');
                    this.on = true;
                    this.lastCycles = this.io.cycles();
                    this.callbacks.driveLight(this.drive, true);
                }
                break;

            case LOC.DRIVE1:  // 0x0a
                this.debug('Disk 1');
                this.drive = 1;
                this.cur = this.drives[this.drive - 1];
                if (this.on) {
                    this.callbacks.driveLight(2, false);
                    this.callbacks.driveLight(1, true);
                }
                break;
            case LOC.DRIVE2:  // 0x0b
                this.debug('Disk 2');
                this.drive = 2;
                this.cur = this.drives[this.drive - 1];
                if (this.on) {
                    this.callbacks.driveLight(1, false);
                    this.callbacks.driveLight(2, true);
                }
                break;

            case LOC.DRIVEREAD: // 0x0c (Q6L) Shift
                this.q6 = 0;
                if (this.writeMode) {
                    this.debug('clearing _q6/SHIFT');
                }
                if (isNibbleDrive(this.cur)) {
                    this.readWriteNext();
                }
                break;

            case LOC.DRIVEWRITE: // 0x0d (Q6H) LOAD
                this.q6 = 1;
                if (this.writeMode) {
                    this.debug('setting _q6/LOAD');
                }
                if (isNibbleDrive(this.cur)) {
                    if (readMode && !this.writeMode) {
                        if (this.cur.readOnly) {
                            this.latch = 0xff;
                            this.debug('Setting readOnly');
                        } else {
                            this.latch = this.latch >> 1;
                            this.debug('Clearing readOnly');
                        }
                    }
                }
                break;

            case LOC.DRIVEREADMODE:  // 0x0e (Q7L)
                this.debug('Read Mode');
                this.q7 = false;
                this.writeMode = false;
                break;
            case LOC.DRIVEWRITEMODE: // 0x0f (Q7H)
                this.debug('Write Mode');
                this.q7 = false;
                this.writeMode = true;
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
                result = this.latch;
            } else {
                result = 0;
            }
        } else {
            // It's not explicitly stated, but writes to any address set the
            // data register.
            this.bus = val!;
        }

        return result;
    }

    private updateDirty(drive: DriveNumber, dirty: boolean) {
        this.drives[drive - 1].dirty = dirty;
        if (this.callbacks.dirty) {
            this.callbacks.dirty(drive, dirty);
        }
    }

    ioSwitch(off: byte, val?: byte) {
        return this.access(off, val);
    }

    read(_page: byte, off: byte) {
        return this.bootstrapRom[off];
    }

    write() { }

    reset() {
        if (this.on) {
            this.callbacks.driveLight(this.drive, false);
            this.writeMode = false;
            this.on = false;
            this.drive = 1;
            this.cur = this.drives[this.drive - 1];
        }
        for (let idx = 0; idx < 4; idx++) {
            this.q[idx] = false;
        }
    }

    tick() {
        this.moveHead();
    }

    // TODO(flan): Does not work for WOZ disks
    getState() {
        const result = {
            drives: [] as DriveState[],
            skip: this.skip,
            latch: this.latch,
            writeMode: this.writeMode,
            on: this.on,
            drive: this.drive
        };
        this.drives.forEach(function (drive, idx) {
            result.drives[idx] = getDriveState(drive);
        });

        return result;
    }

    // TODO(flan): Does not work for WOZ disks
    setState(state: State) {
        this.skip = state.skip;
        this.latch = state.latch;
        this.writeMode = state.writeMode;
        this.on = state.on;
        this.drive = state.drive;
        for (const d of DRIVE_NUMBERS) {
            const idx = d - 1;
            this.drives[idx] = setDriveState(state.drives[idx]);
            this.callbacks.label(d, state.drives[idx].name);
            this.callbacks.driveLight(d, this.on);
            this.callbacks.dirty(d, this.drives[idx].dirty);
        }
        this.cur = this.drives[this.drive - 1];
    }

    // TODO(flan): Does not work for WOZ disks
    getMetadata(driveNo: DriveNumber) {
        const drive = this.drives[driveNo - 1];
        if (isNibbleDrive(drive)) {
            return {
                format: drive.format,
                volume: drive.volume,
                track: drive.track,
                head: drive.head,
                phase: drive.phase,
                readOnly: drive.readOnly,
                dirty: drive.dirty
            };
        } else {
            return null;
        }
    }

    // TODO(flan): Does not work on WOZ disks
    rwts(disk: DriveNumber, track: byte, sector: byte) {
        const cur = this.drives[disk - 1];
        if (!isNibbleDrive(cur)) {
            throw new Error('Can\'t read WOZ disks');
        }
        return readSector(cur, track, sector);
    }

    /** Sets the data for `drive` from `disk`, which is expected to be JSON. */
    // TODO(flan): This implementation is not very safe.
    setDisk(drive: DriveNumber, disk: JSONDisk) {
        const fmt = disk.type;
        const readOnly = disk.readOnly;
        const name = disk.name;

        let data: memory[] | memory[][];
        if (disk.encoding == 'base64') {
            data = [];
            for (let t = 0; t < disk.data.length; t++) {
                if (fmt == 'nib') {
                    data[t] = base64_decode(disk.data[t] as string);
                } else {
                    data[t] = [];
                    for (let s = 0; s < disk.data[t].length; s++) {
                        data[t][s] = base64_decode(disk.data[t][s] as string);
                    }
                }
            }
        } else {
            data = disk.data;
        }
        const cur = this.drives[drive - 1];

        // var v = (fmt === 'dsk' ? data[0x11][0x00][0x06] : 0xfe);
        // if (v == 0x00) {
        const volume = disk.volume || 0xfe;
        // }

        const options = {
            volume,
            readOnly,
            name,
            data
        };

        let newDisk: Disk;
        switch (fmt) {
            case 'd13':
                newDisk = D13(options);
                break;
            case 'do':
            case 'dsk':
                newDisk = DOS(options);
                break;
            case 'nib':
                newDisk = Nibble(options);
                break;
            case 'po':
                newDisk = ProDOS(options);
                break;
            default:
                return false;
        }

        Object.assign(cur, newDisk);
        this.updateDirty(drive, false);
        this.callbacks.label(drive, name);
    }

    getJSON(drive: DriveNumber, pretty: boolean) {
        const cur = this.drives[drive - 1];
        if (!isNibbleDrive(cur)) {
            throw new Error('Can\'t save WOZ disks to JSON');
        }
        return jsonEncode(cur, pretty);
    }

    setJSON(drive: DriveNumber, data: string) {
        const cur = this.drives[drive - 1];
        Object.assign(cur, jsonDecode(data));
        return true;
    }

    setBinary(drive: DriveNumber, name: string, fmt: DiskFormat, rawData: memory) {
        let disk;
        const cur = this.drives[drive - 1];
        const readOnly = false;
        const volume = 254;
        const options = {
            name,
            rawData,
            readOnly,
            volume
        };

        switch (fmt) {
            case '2mg':
                disk = _2MG(options);
                break;
            case 'd13':
                disk = D13(options);
                break;
            case 'do':
            case 'dsk':
                disk = DOS(options);
                break;
            case 'nib':
                disk = Nibble(options);
                break;
            case 'po':
                disk = ProDOS(options);
                break;
            case 'woz':
                disk = Woz(options);
                break;
            default:
                return false;
        }

        Object.assign(cur, disk);
        this.updateDirty(drive, true);
        this.callbacks.label(this.drive, name);
        return true;
    }

    // TODO(flan): Does not work with WOZ disks
    getBinary(drive: DriveNumber) {
        const cur = this.drives[drive - 1];
        if (!isNibbleDrive(cur)) {
            return null;
        }
        // TODO(flan): Assumes 16-sectors
        const len = (16 * cur.tracks.length * 256);
        const data = new Uint8Array(len);

        let idx = 0;
        for (let t = 0; t < cur.tracks.length; t++) {
            if (cur.format === 'nib') {
                data.set(cur.tracks[t], idx);
                idx += cur.tracks[t].length;
            } else {
                for (let s = 0; s < 0x10; s++) {
                    const sector = readSector(cur, t, s);
                    data.set(sector, idx);
                    idx += sector.length;
                }
            }
        }

        return data;
    }

    // TODO(flan): Does not work with WOZ disks
    getBase64(drive: DriveNumber) {
        const cur = this.drives[drive - 1];
        if (!isNibbleDrive(cur)) {
            return null;
        }
        const data: string[][] | string[] = [];
        for (let t = 0; t < cur.tracks.length; t++) {
            if (cur.format === 'nib') {
                data[t] = base64_encode(cur.tracks[t]);
            } else {
                const track: string[] = [];
                for (let s = 0; s < 0x10; s++) {
                    track[s] = base64_encode(readSector(cur, t, s));
                }
                data[t] = track;
            }
        }
        return data;
    }
}
