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
import { debug, toHex } from '../util';
import { jsonDecode, jsonEncode, readSector } from '../formats/format_utils';

import { P5_16, P5_13 } from '../roms/cards/disk2';

import _2MG from '../formats/2mg';
import D13 from '../formats/d13';
import DOS from '../formats/do';
import ProDOS from '../formats/po';
import Woz from '../formats/woz';
import Nibble from '../formats/nib';

export const DISK_TYPES = [
    '2mg',
    'd13',
    'do',
    'dsk',
    'po',
    'nib',
    'woz'
];

export default function DiskII(io, callbacks, sectors = 16)
{
    var _drives = [
        {   // Drive 1
            format: 'dsk',
            volume: 254,
            tracks: [],
            trackMap: null,
            rawTracks: null,
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
            trackMap: null,
            rawTracks: null,
            track: 0,
            head: 0,
            phase: 0,
            readOnly: false,
            dirty: false
        }];

    var _skip = 0;
    var _bus = 0;
    var _latch = 0;
    var _offTimeout = null;
    var _q6 = 0;
    var _q7 = 0;
    var _writeMode = false; // q7
    var _on = false;
    var _drive = 1;
    var _cur = _drives[_drive - 1];

    var LOC = {
        // Disk II Stuff
        PHASE0OFF: 0x80,
        PHASE0ON: 0x81,
        PHASE1OFF: 0x82,
        PHASE1ON: 0x83,
        PHASE2OFF: 0x84,
        PHASE2ON: 0x85,
        PHASE3OFF: 0x86,
        PHASE3ON: 0x87,

        DRIVEOFF: 0x88,
        DRIVEON: 0x89,
        DRIVE1: 0x8A,
        DRIVE2: 0x8B,
        DRIVEREAD: 0x8C,     // Q6L
        DRIVEWRITE: 0x8D,    // Q6H
        DRIVEREADMODE: 0x8E, // Q7L
        DRIVEWRITEMODE: 0x8F // Q7H
    };


    //     CODE  OPERATION                   BEFORE    AFTER
    // 0     CLR                         XXXXXXXX  00000000
    // 8     NOP                         ABCDEFGH  ABCDEFGH
    // 9     SL0                         ABCDEFGH  BCDEFGH0
    // A     SR  (write protected)       ABCDEFGH  11111111
    //           (not write protected)   ABCDEFGH  0ABCDEFG
    // B     LOAD                        XXXXXXXX  YYYYYYYY
    // D     SL1                         ABCDEFGH  BCDEFGH1

    // Q7 Read/Write
    // Q6 Shift/Load

    var _P6 = [
        //                Q7 L (Read)                                         Q7 H (Write)
        //       Q6 L                     Q6 H                   Q6 L (Shift)               Q6 H (Load)
        //  QA L        QA H         QA L        QA H           QA L        QA H         QA L        QA H
        //1     0     1     0      1     0     1     0        1     0     1     0      1     0     1     0
        0x18, 0x18, 0x18, 0x18,  0x0A, 0x0A, 0x0A, 0x0A,    0x18, 0x18, 0x18, 0x18,  0x18, 0x18, 0x18, 0x18, // 0
        0x2D, 0x2D, 0x38, 0x38,  0x0A, 0x0A, 0x0A, 0x0A,    0x28, 0x28, 0x28, 0x28,  0x28, 0x28, 0x28, 0x28, // 1
        0xD8, 0x38, 0x08, 0x28,  0x0A, 0x0A, 0x0A, 0x0A,    0x39, 0x39, 0x39, 0x39,  0x3B, 0x3B, 0x3B, 0x3B, // 2
        0xD8, 0x48, 0x48, 0x48,  0x0A, 0x0A, 0x0A, 0x0A,    0x48, 0x48, 0x48, 0x48,  0x48, 0x48, 0x48, 0x48, // 3
        0xD8, 0x58, 0xD8, 0x58,  0x0A, 0x0A, 0x0A, 0x0A,    0x58, 0x58, 0x58, 0x58,  0x58, 0x58, 0x58, 0x58, // 4
        0xD8, 0x68, 0xD8, 0x68,  0x0A, 0x0A, 0x0A, 0x0A,    0x68, 0x68, 0x68, 0x68,  0x68, 0x68, 0x68, 0x68, // 5
        0xD8, 0x78, 0xD8, 0x78,  0x0A, 0x0A, 0x0A, 0x0A,    0x78, 0x78, 0x78, 0x78,  0x78, 0x78, 0x78, 0x78, // 6
        0xD8, 0x88, 0xD8, 0x88,  0x0A, 0x0A, 0x0A, 0x0A,    0x08, 0x08, 0x88, 0x88,  0x08, 0x08, 0x88, 0x88, // 7
        0xD8, 0x98, 0xD8, 0x98,  0x0A, 0x0A, 0x0A, 0x0A,    0x98, 0x98, 0x98, 0x98,  0x98, 0x98, 0x98, 0x98, // 8
        0xD8, 0x29, 0xD8, 0xA8,  0x0A, 0x0A, 0x0A, 0x0A,    0xA8, 0xA8, 0xA8, 0xA8,  0xA8, 0xA8, 0xA8, 0xA8, // 9
        0xCD, 0xBD, 0xD8, 0xB8,  0x0A, 0x0A, 0x0A, 0x0A,    0xB9, 0xB9, 0xB9, 0xB9,  0xBB, 0xBB, 0xBB, 0xBB, // A
        0xD9, 0x59, 0xD8, 0xC8,  0x0A, 0x0A, 0x0A, 0x0A,    0xC8, 0xC8, 0xC8, 0xC8,  0xC8, 0xC8, 0xC8, 0xC8, // B
        0xD9, 0xD9, 0xD8, 0xA0,  0x0A, 0x0A, 0x0A, 0x0A,    0xD8, 0xD8, 0xD8, 0xD8,  0xD8, 0xD8, 0xD8, 0xD8, // C
        0xD8, 0x08, 0xE8, 0xE8,  0x0A, 0x0A, 0x0A, 0x0A,    0xE8, 0xE8, 0xE8, 0xE8,  0xE8, 0xE8, 0xE8, 0xE8, // D
        0xFD, 0xFD, 0xF8, 0xF8,  0x0A, 0x0A, 0x0A, 0x0A,    0xF8, 0xF8, 0xF8, 0xF8,  0xF8, 0xF8, 0xF8, 0xF8, // E
        0xDD, 0x4D, 0xE0, 0xE0,  0x0A, 0x0A, 0x0A, 0x0A,    0x88, 0x88, 0x08, 0x08,  0x88, 0x88, 0x08, 0x08  // F
    ];

    function _debug() {
        // debug.apply(this, arguments);
    }

    function _init() {
        debug('Disk ][');
    }

    var _clock = 0;
    var _lastCycles = io.cycles();
    var _state = 0;
    var _zeros = 0;

    function _moveHead() {
        if (!_cur.rawTracks) {
            return;
        }
        var track = _cur.rawTracks[_cur.trackMap[_cur.track]] || [0];

        var cycles = io.cycles();
        var workCycles = (cycles - _lastCycles) * 2;
        _lastCycles = cycles;

        while (workCycles-- > 0) {
            var pulse = 0;
            if (_clock == 4) {
                pulse = track[_cur.head];
                if (!pulse) {
                    if (++_zeros > 2) {
                        pulse = Math.random() > 0.5 ? 1 : 0;
                    }
                } else {
                    _zeros = 0;
                }
            }

            var idx = 0;
            idx |= pulse ? 0x00 : 0x01;
            idx |= _latch & 0x80 ? 0x02 : 0x00;
            idx |= _q6 ? 0x04 : 0x00;
            idx |= _q7 ? 0x08 : 0x00;
            idx |= _state << 4;

            var command = _P6[idx];

            if (_on && _q7) {
                debug('clock:', _clock, 'command:', toHex(command), 'q6:', _q6);
            }

            switch (command & 0xf) {
            case 0x0: // CLR
                _latch = 0;
                break;
            case 0x8: // NOP
                break;
            case 0x9: // SL0
                _latch = (_latch << 1) & 0xff;
                break;
            case 0xA: // SR
                _latch >>= 1;
                if (_cur.readOnly) {
                    _latch |= 0x80;
                }
                break;
            case 0xB: // LD
                _latch = _bus;
                debug('Loading', toHex(_latch), 'from bus');
                break;
            case 0xD: // SL1
                _latch = ((_latch << 1) | 0x01) & 0xff;
                break;
            }
            _state = command >> 4;

            if (_clock == 4) {
                if (_on) {
                    if (_q7) {
                        track[_cur.head] = _state & 0x8 ? 0x01 : 0x00;
                        debug('Wrote', _state & 0x8 ? 0x01 : 0x00);
                    }

                    if (++_cur.head >= track.length) {
                        _cur.head = 0;
                    }
                }
            }

            if (++_clock > 7) {
                _clock = 0;
            }
        }
    }

    function _readWriteNext() {
        if (_skip || _writeMode) {
            var track = _cur.tracks[_cur.track >> 2];
            if (track && track.length) {
                if (_cur.head >= track.length) {
                    _cur.head = 0;
                }

                if (_writeMode) {
                    if (!_cur.readOnly) {
                        track[_cur.head] = _bus;
                        if (!_cur.dirty) {
                            _updateDirty(_drive, true);
                        }
                    }
                } else {
                    _latch = track[_cur.head];
                }

                ++_cur.head;
            }
        } else {
            _latch = 0;
        }
        _skip = (++_skip % 2);
    }

    var _phase_delta = [
        [ 0, 1, 2,-1],
        [-1, 0, 1, 2],
        [-2,-1, 0, 1],
        [ 1,-2,-1, 0]
    ];

    var _q = [false, false, false, false]; // q0-3

    function setPhase(phase, on) {
        _debug('phase ' + phase + (on ? ' on' : ' off'));
        if (_cur.rawTracks) {
            if (on) {
                var delta = _phase_delta[_cur.phase][phase] * 2;
                _cur.track += delta;
                _cur.phase = phase;
            } else {
                // foo
            }
        } else {
            if (on) {
                _cur.track += _phase_delta[_cur.phase][phase] * 2;
                _cur.phase = phase;
            }
        }

        if (_cur.track > _cur.tracks.length * 4 - 1) {
            _cur.track = _cur.tracks.length * 4 - 1;
        }
        if (_cur.track < 0x0) {
            _cur.track = 0x0;
        }

        // debug(
        //     'Drive', _drive, 'track', toHex(_cur.track >> 2) + '.' + (_cur.track & 0x3),
        //     '(' + toHex(_cur.track) + ')',
        //     '[' + phase + ':' + (on ? 'on' : 'off') + ']');

        _q[phase] = on;
    }

    function _access(off, val) {
        var result = 0;
        var readMode = val === undefined;

        switch (off & 0x8f) {
        case LOC.PHASE0OFF: // 0x00
            setPhase(0, false);
            break;
        case LOC.PHASE0ON: // 0x01
            setPhase(0, true);
            break;
        case LOC.PHASE1OFF: // 0x02
            setPhase(1, false);
            break;
        case LOC.PHASE1ON: // 0x03
            setPhase(1, true);
            break;
        case LOC.PHASE2OFF: // 0x04
            setPhase(2, false);
            break;
        case LOC.PHASE2ON: // 0x05
            setPhase(2, true);
            break;
        case LOC.PHASE3OFF: // 0x06
            setPhase(3, false);
            break;
        case LOC.PHASE3ON:  // 0x07
            setPhase(3, true);
            break;

        case LOC.DRIVEOFF: // 0x08
            if (!_offTimeout) {
                if (_on) {
                    _offTimeout = window.setTimeout(function() {
                        _debug('Drive Off');
                        _on = false;
                        if (callbacks.driveLight) { callbacks.driveLight(_drive, false); }
                    }, 1000);
                }
            }
            break;
        case LOC.DRIVEON: // 0x09
            if (_offTimeout) {
                window.clearTimeout(_offTimeout);
                _offTimeout = null;
            }
            if (!_on) {
                _debug('Drive On');
                _on = true;
                _lastCycles = io.cycles();
                if (callbacks.driveLight) { callbacks.driveLight(_drive, true); }
            }
            break;

        case LOC.DRIVE1:  // 0x0a
            _debug('Disk 1');
            _drive = 1;
            _cur = _drives[_drive - 1];
            if (_on && callbacks.driveLight) {
                callbacks.driveLight(2, false);
                callbacks.driveLight(1, true);
            }
            break;
        case LOC.DRIVE2:  // 0x0b
            _debug('Disk 2');
            _drive = 2;
            _cur = _drives[_drive - 1];
            if (_on && callbacks.driveLight)  {
                callbacks.driveLight(1, false);
                callbacks.driveLight(2, true);
            }
            break;

        case LOC.DRIVEREAD: // 0x0c (Q6L) Shift
            _q6 = 0;
            if (_writeMode) {
                _debug('clearing _q6/SHIFT');
            }
            if (!_cur.rawTracks) {
                _readWriteNext();
            }
            break;

        case LOC.DRIVEWRITE: // 0x0d (Q6H) LOAD
            _q6 = 1;
            if (_writeMode) {
                _debug('setting _q6/LOAD');
            }
            if (!_cur.rawTracks) {
                if (readMode && !_writeMode) {
                    if (_cur.readOnly) {
                        _latch = 0xff;
                        _debug('Setting readOnly');
                    } else {
                        _latch = _latch >> 1;
                        _debug('Clearing readOnly');
                    }
                }
            }
            break;

        case LOC.DRIVEREADMODE:  // 0x0e (Q7L)
            _debug('Read Mode');
            _q7 = 0;
            _writeMode = false;
            break;
        case LOC.DRIVEWRITEMODE: // 0x0f (Q7H)
            _debug('Write Mode');
            _q7 = 1;
            _writeMode = true;
            break;

        default:
            break;
        }

        _moveHead();

        if (readMode) {
            if ((off & 0x01) === 0) {
                result = _latch;
            } else {
                result = 0;
            }
        } else {
            _bus = val;
        }

        return result;
    }

    function _updateDirty(drive, dirty) {
        _drives[drive - 1].dirty = dirty;
        if (callbacks.dirty) { callbacks.dirty(_drive, dirty); }
    }

    var _P5 = sectors == 16 ? P5_16 : P5_13;

    _init();

    return {
        ioSwitch: function disk2_ioSwitch(off, val) {
            return _access(off, val);
        },

        read: function disk2_read(page, off) {
            return _P5[off];
        },

        write: function disk2_write() {},

        reset: function disk2_reset() {
            if (_on) {
                callbacks.driveLight(_drive, false);
                _writeMode = false;
                _on = false;
                _drive = 1;
                _cur = _drives[_drive - 1];
            }
            for (var idx = 0; idx < 4; idx++) {
                _q[idx] = false;
            }
        },

        tick: function disk2_tick() {
            _moveHead();
        },

        getState: function disk2_getState() {
            function getDriveState(drive) {
                var result = {
                    format: drive.format,
                    volume: drive.volume,
                    tracks: [],
                    track: drive.track,
                    head: drive.head,
                    phase: drive.phase,
                    readOnly: drive.readOnly,
                    dirty: drive.dirty
                };
                for (var idx = 0; idx < drive.tracks.length; idx++) {
                    result.tracks.push(base64_encode(drive.tracks[idx]));
                }
                return result;
            }
            var result = {
                drives: [],
                skip: _skip,
                latch: _latch,
                writeMode: _writeMode,
                on: _on,
                drive: _drive
            };
            _drives.forEach(function(drive, idx) {
                result.drives[idx] = getDriveState(drive);
            });

            return result;
        },

        setState: function disk2_setState(state) {
            function setDriveState(state) {
                var result = {
                    format: state.format,
                    volume: state.volume,
                    tracks: [],
                    track: state.track,
                    head: state.head,
                    phase: state.phase,
                    readOnly: state.readOnly,
                    dirty: state.dirty
                };
                for (var idx = 0; idx < state.tracks.length; idx++) {
                    result.tracks.push(base64_decode(state.tracks[idx]));
                }
                return result;
            }
            state.drives.forEach(function(drive, idx) {
                _drives[idx] = setDriveState(drive);
                callbacks.driveLight(idx, _drive.on);
                callbacks.dirty(idx, _drive.dirty);
            });
            _skip = state.skip;
            _latch = state.latch;
            _writeMode = state.writeMode;
            _on = state.on;
            _drive = state.drive;
            _cur = _drives[_drive - 1];
        },

        getMetadata: function disk_getMetadata(driveNo) {
            var drive = _drives[driveNo - 1];
            if (drive.tracks.length) {
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
        },

        rwts: function disk2_rwts(disk, track, sector) {
            var cur = _drives[disk - 1];
            return readSector(cur, track, sector);
        },

        setDisk: function disk2_setDisk(drive, disk) {
            var fmt = disk.type, readOnly = disk.readOnly;

            var data, t, s;
            if (disk.encoding == 'base64') {
                data = [];
                for (t = 0; t < disk.data.length; t++) {
                    if (fmt == 'nib') {
                        data[t] = base64_decode(disk.data[t]);
                    } else {
                        data[t] = [];
                        for (s = 0; s < disk.data[t].length; s++) {
                            data[t][s] = base64_decode(disk.data[t][s]);
                        }
                    }
                }
            } else {
                data = disk.data;
            }
            var cur = _drives[drive - 1];

            // var v = (fmt === 'dsk' ? data[0x11][0x00][0x06] : 0xfe);
            // if (v == 0x00) {
            var volume = disk.volume || 0xfe;
            // }

            var options = {
                volume,
                readOnly,
                name,
                data
            };

            switch (fmt) {
            case 'd13':
                disk = new D13(options);
                break;
            case 'do':
            case 'dsk':
                disk = new DOS(options);
                break;
            case 'nib':
                disk = new Nibble(options);
                break;
            case 'po':
                disk = new ProDOS(options);
                break;
            default:
                return false;
            }

            Object.assign(cur, disk);
            _updateDirty(_drive, false);
        },

        getJSON: function disk2_getJSON(drive, pretty) {
            var cur = _drives[drive - 1];
            return jsonEncode(cur, pretty);
        },

        setJSON: function disk2_setJSON(drive, data) {
            var cur = _drives[drive - 1];
            Object.assign(cur, jsonDecode(data));
            return true;
        },

        setBinary: function disk2_setBinary(drive, name, fmt, rawData) {
            var disk;
            var cur = _drives[drive - 1];
            var readOnly = false;
            var volume = 254;
            var options = {
                name,
                rawData,
                readOnly,
                volume
            };

            switch (fmt) {
            case '2mg':
                disk = new _2MG(options);
                break;
            case 'd13':
                disk = new D13(options);
                break;
            case 'do':
            case 'dsk':
                disk = new DOS(options);
                break;
            case 'nib':
                disk = new Nibble(options);
                break;
            case 'po':
                disk = new ProDOS(options);
                break;
            case 'woz':
                disk = new Woz(options);
                break;
            default:
                return false;
            }

            Object.assign(cur, disk);
            _updateDirty(drive, true);
            return true;
        },

        getBinary: function disk2_getBinary(drive) {
            var cur = _drives[drive - 1];
            var len = (16 * cur.tracks.length * 256);
            var data = new Uint8Array(len);
            var idx = 0;

            for (var t = 0; t < cur.tracks.length; t++) {
                if (cur.format === 'nib') {
                    data[idx++] = cur.tracks[t];
                } else {
                    for (var s = 0; s < 0x10; s++) {
                        var sector = readSector(cur, t, s);
                        for (var b = 0; b < 256; b++) {
                            data[idx++] = sector[b];
                        }
                    }
                }
            }

            return data;
        },

        getBase64: function disk2_getBase64(drive) {
            var cur = _drives[drive - 1];
            var data = [];
            for (var t = 0; t < cur.tracks.length; t++) {
                data[t] = [];
                if (cur.format === 'nib') {
                    data += base64_encode(cur.tracks[t]);
                } else {
                    for (var s = 0; s < 0x10; s++) {
                        data += base64_encode(readSector(cur, t, s));
                    }
                }
            }
            return data;
        }
    };
}
