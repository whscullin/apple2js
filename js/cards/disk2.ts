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

import { base64_decode, base64_encode } from '../base64';
import { byte, DiskFormat, MemberOf, memory, rom } from '../types';
import { debug, toHex } from '../util';
import { Disk, jsonDecode, jsonEncode, readSector } from '../formats/format_utils';

import { P5_16, P5_13 } from '../roms/cards/disk2';

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

const _P6 = [
    // See Understanding the Apple IIe, Figure 9.11 The DOS 3.3 Logic State Sequencer
    //                Q7 L (Read)                                         Q7 H (Write)
    //       Q6 L                     Q6 H                   Q6 L (Shift)               Q6 H (Load)
    //  QA L        QA H         QA L        QA H           QA L        QA H         QA L        QA H
    //1     0     1     0      1     0     1     0        1     0     1     0      1     0     1     0
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

type Phase = 0 | 1 | 2 | 3;

const _phase_delta = [
    [0, 1, 2, -1],
    [-1, 0, 1, 2],
    [-2, -1, 0, 1],
    [1, -2, -1, 0]
] as const;

const DRIVE_NUMBERS = [1, 2] as const;
type DriveNumber = MemberOf<typeof DRIVE_NUMBERS>;

interface Callbacks {
    driveLight: (drive: DriveNumber, on: boolean) => void;
    dirty: (drive: DriveNumber, dirty: boolean) => void;
}

interface BaseDrive {
    format: DiskFormat,
    volume: byte,
    track: byte,
    head: byte,
    phase: Phase,
    readOnly: boolean,
    dirty: boolean,
}

// WOZ format track data from https://applesaucefdc.com/woz/reference2/
interface WozDrive extends BaseDrive {
    // Maps quarter tracks to data is rawTracks; 0xFF = random garbage
    trackMap: byte[];
    // Unique tracks. The index is arbitrary—_not_ the track number.
    rawTracks: memory[];
}

interface NibbleDrive extends BaseDrive {
    // Nibble data. The index is the track number.
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
    tracks: string[],
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
        tracks: [] as string[],
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
        result.tracks.push(base64_encode(drive.tracks[idx]));
    }
    return result;
}

// TODO(flan): Does not work for WOZ disks
function setDriveState(state: DriveState) {
    const result: Drive = {
        format: state.format,
        volume: state.volume,
        tracks: [] as memory[],
        track: state.track,
        head: state.head,
        phase: state.phase,
        readOnly: state.readOnly,
        dirty: state.dirty
    };
    for (let idx = 0; idx < state.tracks.length; idx++) {
        result.tracks!.push(base64_decode(state.tracks[idx]));
    }
    return result;
}

/**
 * Emulates the 16-sector version of the Disk ][ drive and controller.
 */
export default class DiskII {

    private _drives: Drive[] = [
        {   // Drive 1
            format: 'dsk',
            volume: 254,
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
            tracks: [],
            track: 0,
            head: 0,
            phase: 0,
            readOnly: false,
            dirty: false
        }];

    private _skip = 0;
    private _bus = 0;
    private _latch = 0;
    private _offTimeout: number | null = null;
    private _q6 = 0;
    private _q7 = 0;
    private _writeMode = false; // q7
    private _on = false;
    private _drive: DriveNumber = 1;
    private _cur = this._drives[this._drive - 1];

    private _q = [false, false, false, false]; // q0-3: phase

    private _clock = 0;
    private _lastCycles = 0;
    private _state = 0;
    private _zeros = 0;

    private _P5: rom;

    constructor(private io: Apple2IO, private callbacks: Callbacks, private sectors = 16) {
        this._lastCycles = this.io.cycles();
        // TODO(flan): This changes the port ROM but does not change the LSS
        this._P5 = this.sectors == 16 ? P5_16 : P5_13;

        this._init();
    }

    _debug(..._args: any) {
        // debug.apply(this, arguments);
    }

    _init() {
        this._debug('Disk ][');
    }

    // Only used for WOZ disks
    _moveHead() {
        if (isNibbleDrive(this._cur)) {
            return;
        }
        const track = this._cur.rawTracks[this._cur.trackMap[this._cur.track]] || [0];

        const cycles = this.io.cycles();
        let workCycles = (cycles - this._lastCycles) * 2;
        this._lastCycles = cycles;

        while (workCycles-- > 0) {
            let pulse = 0;
            if (this._clock == 4) {
                pulse = track[this._cur.head];
                if (!pulse) {
                    if (++this._zeros > 2) {
                        pulse = Math.random() > 0.5 ? 1 : 0;
                    }
                } else {
                    this._zeros = 0;
                }
            }

            let idx = 0;
            idx |= pulse ? 0x00 : 0x01;
            idx |= this._latch & 0x80 ? 0x02 : 0x00;
            idx |= this._q6 ? 0x04 : 0x00;
            idx |= this._q7 ? 0x08 : 0x00;
            idx |= this._state << 4;

            const command = _P6[idx];

            if (this._on && this._q7) {
                debug('clock:', this._clock, 'command:', toHex(command), 'q6:', this._q6);
            }

            switch (command & 0xf) {
                case 0x0: // CLR
                    this._latch = 0;
                    break;
                case 0x8: // NOP
                    break;
                case 0x9: // SL0
                    this._latch = (this._latch << 1) & 0xff;
                    break;
                case 0xA: // SR
                    this._latch >>= 1;
                    if (this._cur.readOnly) {
                        this._latch |= 0x80;
                    }
                    break;
                case 0xB: // LD
                    this._latch = this._bus;
                    debug('Loading', toHex(this._latch), 'from bus');
                    break;
                case 0xD: // SL1
                    this._latch = ((this._latch << 1) | 0x01) & 0xff;
                    break;
            }
            this._state = command >> 4;

            if (this._clock == 4) {
                if (this._on) {
                    if (this._q7) {
                        track[this._cur.head] = this._state & 0x8 ? 0x01 : 0x00;
                        debug('Wrote', this._state & 0x8 ? 0x01 : 0x00);
                    }

                    if (++this._cur.head >= track.length) {
                        this._cur.head = 0;
                    }
                }
            }

            if (++this._clock > 7) {
                this._clock = 0;
            }
        }
    }

    // Only called for non-WOZ disks
    _readWriteNext() {
        if (!isNibbleDrive(this._cur)) {
            return;
        }
        if (this._skip || this._writeMode) {
            const track = this._cur.tracks![this._cur.track >> 2];
            if (track && track.length) {
                if (this._cur.head >= track.length) {
                    this._cur.head = 0;
                }

                if (this._writeMode) {
                    if (!this._cur.readOnly) {
                        track[this._cur.head] = this._bus;
                        if (!this._cur.dirty) {
                            this._updateDirty(this._drive, true);
                        }
                    }
                } else {
                    this._latch = track[this._cur.head];
                }

                ++this._cur.head;
            }
        } else {
            this._latch = 0;
        }
        this._skip = (++this._skip % 2);
    }

    setPhase(phase: Phase, on: boolean) {
        this._debug('phase ' + phase + (on ? ' on' : ' off'));
        if (isNibbleDrive(this._cur)) {
            if (on) {
                this._cur.track += _phase_delta[this._cur.phase][phase] * 2;
                this._cur.phase = phase;
            }
        } else {
            if (on) {
                const delta = _phase_delta[this._cur.phase][phase] * 2;
                this._cur.track += delta;
                this._cur.phase = phase;
            } else {
                // foo
            }
        }

        const maxTrack = isNibbleDrive(this._cur)
            ? this._cur.tracks.length * 4 - 1
            : this._cur.trackMap.length - 1;
        if (this._cur.track > maxTrack) {
            this._cur.track = maxTrack;
        }
        if (this._cur.track < 0x0) {
            this._cur.track = 0x0;
        }

        // debug(
        //     'Drive', _drive, 'track', toHex(_cur.track >> 2) + '.' + (_cur.track & 0x3),
        //     '(' + toHex(_cur.track) + ')',
        //     '[' + phase + ':' + (on ? 'on' : 'off') + ']');

        this._q[phase] = on;
    }

    _access(off: byte, val: byte) {
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
                if (!this._offTimeout) {
                    if (this._on) {
                        // TODO(flan): This is fragile because it relies on
                        // wall-clock time instead of emulator time.
                        this._offTimeout = window.setTimeout(() => {
                            this._debug('Drive Off');
                            this._on = false;
                            if (this.callbacks.driveLight) {
                                this.callbacks.driveLight(this._drive, false);
                            }
                        }, 1000);
                    }
                }
                break;
            case LOC.DRIVEON: // 0x09
                if (this._offTimeout) {
                    // TODO(flan): Fragile—see above
                    window.clearTimeout(this._offTimeout);
                    this._offTimeout = null;
                }
                if (!this._on) {
                    this._debug('Drive On');
                    this._on = true;
                    this._lastCycles = this.io.cycles();
                    if (this.callbacks.driveLight) { this.callbacks.driveLight(this._drive, true); }
                }
                break;

            case LOC.DRIVE1:  // 0x0a
                this._debug('Disk 1');
                this._drive = 1;
                this._cur = this._drives[this._drive - 1];
                if (this._on && this.callbacks.driveLight) {
                    this.callbacks.driveLight(2, false);
                    this.callbacks.driveLight(1, true);
                }
                break;
            case LOC.DRIVE2:  // 0x0b
                this._debug('Disk 2');
                this._drive = 2;
                this._cur = this._drives[this._drive - 1];
                if (this._on && this.callbacks.driveLight) {
                    this.callbacks.driveLight(1, false);
                    this.callbacks.driveLight(2, true);
                }
                break;

            case LOC.DRIVEREAD: // 0x0c (Q6L) Shift
                this._q6 = 0;
                if (this._writeMode) {
                    this._debug('clearing _q6/SHIFT');
                }
                if (isNibbleDrive(this._cur)) {
                    this._readWriteNext();
                }
                break;

            case LOC.DRIVEWRITE: // 0x0d (Q6H) LOAD
                this._q6 = 1;
                if (this._writeMode) {
                    this._debug('setting _q6/LOAD');
                }
                if (isNibbleDrive(this._cur)) {
                    if (readMode && !this._writeMode) {
                        if (this._cur.readOnly) {
                            this._latch = 0xff;
                            this._debug('Setting readOnly');
                        } else {
                            this._latch = this._latch >> 1;
                            this._debug('Clearing readOnly');
                        }
                    }
                }
                break;

            case LOC.DRIVEREADMODE:  // 0x0e (Q7L)
                this._debug('Read Mode');
                this._q7 = 0;
                this._writeMode = false;
                break;
            case LOC.DRIVEWRITEMODE: // 0x0f (Q7H)
                this._debug('Write Mode');
                this._q7 = 1;
                this._writeMode = true;
                break;

            default:
                break;
        }

        this._moveHead();

        if (readMode) {
            if ((off & 0x01) === 0) {
                result = this._latch;
            } else {
                result = 0;
            }
        } else {
            this._bus = val;
        }

        return result;
    }

    _updateDirty(drive: DriveNumber, dirty: boolean) {
        this._drives[drive - 1].dirty = dirty;
        if (this.callbacks.dirty) {
            this.callbacks.dirty(drive, dirty);
        }
    }

    ioSwitch(off: byte, val: byte) {
        return this._access(off, val);
    }

    read(_page: byte, off: byte) {
        return this._P5[off];
    }

    write() { }

    reset() {
        if (this._on) {
            this.callbacks.driveLight(this._drive, false);
            this._writeMode = false;
            this._on = false;
            this._drive = 1;
            this._cur = this._drives[this._drive - 1];
        }
        for (let idx = 0; idx < 4; idx++) {
            this._q[idx] = false;
        }
    }

    tick() {
        this._moveHead();
    }

    // TODO(flan): Does not work for WOZ disks
    getState() {
        const result = {
            drives: [] as DriveState[],
            skip: this._skip,
            latch: this._latch,
            writeMode: this._writeMode,
            on: this._on,
            drive: this._drive
        };
        this._drives.forEach(function (drive, idx) {
            result.drives[idx] = getDriveState(drive);
        });

        return result;
    }

    // TODO(flan): Does not work for WOZ disks
    setState(state: State) {
        this._skip = state.skip;
        this._latch = state.latch;
        this._writeMode = state.writeMode;
        this._on = state.on;
        this._drive = state.drive;
        for (const d of DRIVE_NUMBERS) {
            this._drives[d - 1] = setDriveState(state.drives[d - 1]);
            this.callbacks.driveLight(d, this._on);
            this.callbacks.dirty(d, this._drives[d - 1].dirty);
        }
        this._cur = this._drives[this._drive - 1];
    }

    // TODO(flan): Does not work for WOZ disks
    getMetadata(driveNo: DriveNumber) {
        const drive = this._drives[driveNo - 1];
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
        const cur = this._drives[disk - 1];
        if (!isNibbleDrive(cur)) {
            throw new Error('Can\'t read WOZ disks');
        }
        return readSector(cur, track, sector);
    }

    /** Sets the data for `drive` from `disk`, which is expected to be JSON. */
    // TODO(flan): This implementation is not very safe.
    setDisk(drive: DriveNumber, disk: any) {
        const fmt = disk.type as DiskFormat;
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
        const cur = this._drives[drive - 1];

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
        this._updateDirty(this._drive, false);
    }

    getJSON(drive: DriveNumber, pretty: boolean) {
        const cur = this._drives[drive - 1];
        if (!isNibbleDrive(cur)) {
            throw new Error('Can\'t save WOZ disks to JSON');
        }
        return jsonEncode(cur, pretty);
    }

    setJSON(drive: DriveNumber, data: any) {
        const cur = this._drives[drive - 1];
        Object.assign(cur, jsonDecode(data));
        return true;
    }

    setBinary(drive: DriveNumber, name: string, fmt: DiskFormat, rawData: memory) {
        let disk;
        const cur = this._drives[drive - 1];
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
        this._updateDirty(drive, true);
        return true;
    }

    // TODO(flan): Does not work with WOZ disks
    getBinary(drive: DriveNumber) {
        const cur = this._drives[drive - 1];
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
        const cur = this._drives[drive - 1];
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