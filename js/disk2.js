/* Copyright 2010-2016 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

/*exported DiskII */
/*globals bytify, each: false, extend: false
          base64_encode, base64_decode
          Uint8Array
*/

function DiskII(io, callbacks, slot)
{
    'use strict';

    slot = slot || 6;
    var _drives = [
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

    var _skip = 0;
    var _latch = 0;
    var _writeMode = false;
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

//    var DO = [0x0,0x7,0xE,0x6,0xD,0x5,0xC,0x4,
//              0xB,0x3,0xA,0x2,0x9,0x1,0x8,0xF];
    var _DO = [0x0,0xD,0xB,0x9,0x7,0x5,0x3,0x1,
               0xE,0xC,0xA,0x8,0x6,0x4,0x2,0xF];

//    var PO = [0x0,0x8,0x1,0x9,0x2,0xa,0x3,0xb,
//              0x4,0xc,0x5,0xd,0x6,0xe,0x7,0xf];
    var _PO = [0x0,0x2,0x4,0x6,0x8,0xa,0xc,0xe,
               0x1,0x3,0x5,0x7,0x9,0xb,0xd,0xf];

    var _trans = [0x96, 0x97, 0x9a, 0x9b, 0x9d, 0x9e, 0x9f, 0xa6,
                  0xa7, 0xab, 0xac, 0xad, 0xae, 0xaf, 0xb2, 0xb3,
                  0xb4, 0xb5, 0xb6, 0xb7, 0xb9, 0xba, 0xbb, 0xbc,
                  0xbd, 0xbe, 0xbf, 0xcb, 0xcd, 0xce, 0xcf, 0xd3,
                  0xd6, 0xd7, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde,
                  0xdf, 0xe5, 0xe6, 0xe7, 0xe9, 0xea, 0xeb, 0xec,
                  0xed, 0xee, 0xef, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6,
                  0xf7, 0xf9, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe, 0xff];

    var _detrans = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
                    0x00, 0x00, 0x02, 0x03, 0x00, 0x04, 0x05, 0x06,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x07, 0x08,
                    0x00, 0x00, 0x00, 0x09, 0x0A, 0x0B, 0x0C, 0x0D,
                    0x00, 0x00, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13,
                    0x00, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x1B, 0x00, 0x1C, 0x1D, 0x1E,
                    0x00, 0x00, 0x00, 0x1F, 0x00, 0x00, 0x20, 0x21,
                    0x00, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x29, 0x2A, 0x2B,
                    0x00, 0x2C, 0x2D, 0x2E, 0x2F, 0x30, 0x31, 0x32,
                    0x00, 0x00, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38,
                    0x00, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E, 0x3F];

    function _debug() {
        // debug.apply(this, arguments);
    }

    function _init() {
        each(LOC, function(key) {
            LOC[key] += slot * 0x10;
        });
    }

    /**
     * From Beneath Apple DOS
     */

    function _fourXfour(val) {
        var xx = val & 0xaa;
        var yy = val & 0x55;

        xx >>= 1;
        xx |= 0xaa;
        yy |= 0xaa;

        return [xx, yy];
    }

    function _defourXfour(xx, yy) {
        return ((xx << 1) | 0x01) & yy;
    }

    function _explodeSector(volume, track, sector, data) {
        var checksum;

        var buf = [], idx;

        var gap;

        /*
         * Gap 1/3 (40/0x28 bytes)
         */

        if (sector === 0) // Gap 1
            gap = 0x80;
        else { // Gap 3
            gap = track === 0 ? 0x28 : 0x26;
        }

        for (idx = 0; idx < gap; idx++) {
            buf.push(0xff);
        }

        /*
         * Address Field
         */

        checksum  = volume ^ track ^ sector;
        extend(buf, [0xd5, 0xaa, 0x96]); // Address Prolog D5 AA 96
        extend(buf, _fourXfour(volume));
        extend(buf, _fourXfour(track));
        extend(buf, _fourXfour(sector));
        extend(buf, _fourXfour(checksum));
        extend(buf, [0xde, 0xaa, 0xeb]); // Epilog DE AA EB

        /*
         * Gap 2 (5 bytes)
         */

        for (idx = 0; idx < 0x05; idx++) {
            buf.push(0xff);
        }

        /*
         * Data Field
         */

        extend(buf, [0xd5, 0xaa, 0xad]); // Data Prolog D5 AA AD

        var nibbles = [];
        var ptr2 = 0;
        var ptr6 = 0x56;
        var idx2, idx6;

        for (idx = 0; idx < 0x156; idx++) {
            nibbles[idx] = 0;
        }

        idx2 = 0x55;
        for (idx6 = 0x101; idx6 >= 0; idx6--) {
            var val6 = data[idx6 % 0x100];
            var val2 = nibbles[ptr2 + idx2];

            val2 = (val2 << 1) | (val6 & 1);
            val6 >>= 1;
            val2 = (val2 << 1) | (val6 & 1);
            val6 >>= 1;

            nibbles[ptr6 + idx6] = val6;
            nibbles[ptr2 + idx2] = val2;

            if (--idx2 < 0)
                idx2 = 0x55;
        }

        var last = 0;
        for (idx = 0; idx < 0x156; idx++) {
            var val = nibbles[idx];
            buf.push(_trans[last ^ val]);
            last = val;
        }
        buf.push(_trans[last]);

        extend(buf, [0xde, 0xaa, 0xeb]); // Epilog DE AA EB

        /*
         * Gap 3
         */

        buf.push(0xff);

        return buf;
    }

    function _json_encode(drive, pretty) {
        var cur = _drives[drive - 1];
        var data = [];
        var format = 'dsk';
        for (var t = 0; t < cur.tracks.length; t++) {
            data[t] = [];
            if (cur.format === 'nib') {
                format = 'nib';
                data[t] = base64_encode(cur.tracks[t]);
            } else {
                for (var s = 0; s < 0x10; s++) {
                    data[t][s] = base64_encode(_readSector(drive, t, _DO[s]));
                }
            }
        }
        return JSON.stringify({'type': format,
                               'encoding': 'base64',
                               'volume': cur.volume,
                               'data': data},
                               null,
                               pretty ? '    ' : null);
    }

    function _json_decode(drive, data) {
        var _cur = _drives[drive - 1];
        var tracks = [];
        var json = JSON.parse(data);
        var v = json.volume;
        for (var t = 0; t < json.data.length; t++) {
            var track = [];
            for (var s = 0; s < json.data[t].length; s++) {
                var _s = 15 - s;
                var d = base64_decode(json.data[t][_s]);
                extend(track, _explodeSector(v, t, _DO[_s], d));
            }
            tracks[t] = bytify(track);
        }
        _cur.volume = v;
        _cur.format = json.type;
        _cur.tracks = tracks;
    }

    function _readNext() {
        var result = 0;
        if (_skip || _writeMode) {
            var t = _cur.tracks[_cur.track >> 1];
            if (t && t.length) {
                if (_cur.head >= t.length)
                    _cur.head = 0;

                if (_writeMode) {
                    t[_cur.head] = _latch;
                } else
                    result = t[_cur.head];

                ++_cur.head;
            }
        }
        _skip = (++_skip % 4);
        return result;
    }

    function _writeNext(val) {
        if (_writeMode) {
            _latch = val;
            if (!_cur.dirty) {
                _updateDirty(_drive, true);
            }
        }
    }

    function _readSector(drive, track, sector) {
        var val, state = 0;
        var idx = 0;
        var retry = 0;
        var cur = _drives[drive - 1].tracks[track];

        function _readNext() {
            var result = cur[idx++];
            if (idx >= cur.length) {
                idx = 0;
                retry++;
            }
            return result;
        }
        function _skipBytes(count) {
            idx += count;
            if (idx >= cur.length) {
                idx %= cur.length;
                retry++;
            }
        }
        var t = 0, s = 0, jdx, kdx;
        var data = [];
        while (retry < 4) {
            switch (state) {
            case 0:
                val = _readNext();
                state = (val === 0xd5) ? 1 : 0;
                break;
            case 1:
                val = _readNext();
                state = (val === 0xaa) ? 2 : 0;
                break;
            case 2:
                val = _readNext();
                state = (val === 0x96) ? 3 : (val === 0xad ? 4 : 0);
                break;
            case 3: // Address
                _defourXfour(_readNext(), _readNext()); // Volume
                t = _defourXfour(_readNext(), _readNext());
                s = _defourXfour(_readNext(), _readNext());
                _skipBytes(5); // Skip checksum and footer
                state = 0;
                break;
            case 4: // Data
                if (s === sector && t === track) {
                    var data2 = [];
                    var last = 0;
                    for (jdx = 0x55; jdx >= 0; jdx--)  {
                        val = _detrans[_readNext() - 0x80] ^ last;
                        data2[jdx] = val;
                        last = val;
                    }
                    for (jdx = 0; jdx < 0x100; jdx++) {
                        val = _detrans[_readNext() - 0x80] ^ last;
                        data[jdx] = val;
                        last = val;
                    }
                    for (kdx = 0, jdx = 0x55; kdx < 0x100; kdx++) {
                        data[kdx] <<= 1;
                        if (data2[jdx] & 0x01) data[kdx] |= 0x01;
                        data2[jdx] >>= 1;

                        data[kdx] <<= 1;
                        if (data2[jdx] & 0x01) data[kdx] |= 0x01;
                        data2[jdx] >>= 1;

                        if (--jdx < 0) jdx = 0x55;
                    }
                    return data;
                }
                else
                    _skipBytes(0x159); // Skip data, checksum and footer
                state = 0;
                break;
            default:
                break;
            }
        }
        return [];
    }

    var _phase_delta = [[ 0, 1, 2,-1],
                        [-1, 0, 1, 2],
                        [-2,-1, 0, 1],
                        [ 1,-2,-1, 0]];

    function setPhase(phase, on) {
        _debug('phase ' + phase + (on ? ' on' : ' off'));
        if (on) {
            _cur.track += _phase_delta[_cur.phase][phase];
            _cur.phase = phase;

            if (_cur.track > _cur.tracks.length * 2 - 1)
                _cur.track = _cur.tracks.length * 2 - 1;
            if (_cur.track < 0x0)
                _cur.track = 0x0;

            /* _debug('Drive ' + _drive +
                   ', track ' + toHex(_cur.track >> 1) +
                   ' (' + toHex(_cur.track) + ')' +
                   ' [' + (_cur.track % 4) + '/' + phase + ']'); */
        }
    }

    function _access(off, val) {
        var result = 0;
        switch (off) {
        case LOC.PHASE0OFF:
            setPhase(0, false);
            break;
        case LOC.PHASE0ON:
            setPhase(0, true);
            break;
        case LOC.PHASE1OFF:
            setPhase(1, false);
            break;
        case LOC.PHASE1ON:
            setPhase(1, true);
            break;
        case LOC.PHASE2OFF:
            setPhase(2, false);
            break;
        case LOC.PHASE2ON:
            setPhase(2, true);
            break;
        case LOC.PHASE3OFF:
            setPhase(3, false);
            break;
        case LOC.PHASE3ON:
            setPhase(3, true);
            break;

        case LOC.DRIVEOFF:
            _debug('Drive Off');
            _on = false;
            if (callbacks.driveLight) { callbacks.driveLight(_drive, false); }
            break;
        case LOC.DRIVEON:
            _debug('Drive On');
            _on = true;
            if (callbacks.driveLight) { callbacks.driveLight(_drive, true); }
            break;

        case LOC.DRIVE1:
            _debug('Disk 1');
            _drive = 1;
            _cur = _drives[_drive - 1];
            if (_on && callbacks.driveLight) {
                callbacks.driveLight(2, false);
                callbacks.driveLight(1, true);
            }
            break;
        case LOC.DRIVE2:
            _debug('Disk 2');
            _drive = 2;
            _cur = _drives[_drive - 1];
            if (_on && callbacks.driveLight)  {
                callbacks.driveLight(1, false);
                callbacks.driveLight(2, true);
            }
            break;

        case LOC.DRIVEREAD:
            result = _readNext();
            // _debug('read: ' + toHex(result));
            break;

        case LOC.DRIVEWRITE:
            // _debug('write: ' + toHex(val));
            if (val !== undefined) {
                _writeNext(val);
            }
            break;
        case LOC.DRIVEREADMODE:
            _debug('Read Mode');
            _writeMode = false;
            result = (_readNext() & 0x7f) | (_cur.readOnly ? 0x80 : 0x00);
            break;
        case LOC.DRIVEWRITEMODE:
            _debug('Write Mode');
            _writeMode = true;
            break;
        default:
            break;
        }
        return result;
    }

    function _updateDirty(drive, dirty) {
        _drives[drive - 1].dirty = dirty;
        if (callbacks.dirty) { callbacks.dirty(_drive, dirty); }
    }

    var diskII_16 = [
        0xa2,0x20,0xa0,0x00,0xa2,0x03,0x86,0x3c,
        0x8a,0x0a,0x24,0x3c,0xf0,0x10,0x05,0x3c,
        0x49,0xff,0x29,0x7e,0xb0,0x08,0x4a,0xd0,
        0xfb,0x98,0x9d,0x56,0x03,0xc8,0xe8,0x10,
        0xe5,0x20,0x58,0xff,0xba,0xbd,0x00,0x01,
        0x0a,0x0a,0x0a,0x0a,0x85,0x2b,0xaa,0xbd,
        0x8e,0xc0,0xbd,0x8c,0xc0,0xbd,0x8a,0xc0,
        0xbd,0x89,0xc0,0xa0,0x50,0xbd,0x80,0xc0,
        0x98,0x29,0x03,0x0a,0x05,0x2b,0xaa,0xbd,
        0x81,0xc0,0xa9,0x56,0x20,0xa8,0xfc,0x88,
        0x10,0xeb,0x85,0x26,0x85,0x3d,0x85,0x41,
        0xa9,0x08,0x85,0x27,0x18,0x08,0xbd,0x8c,
        0xc0,0x10,0xfb,0x49,0xd5,0xd0,0xf7,0xbd,
        0x8c,0xc0,0x10,0xfb,0xc9,0xaa,0xd0,0xf3,
        0xea,0xbd,0x8c,0xc0,0x10,0xfb,0xc9,0x96,
        0xf0,0x09,0x28,0x90,0xdf,0x49,0xad,0xf0,
        0x25,0xd0,0xd9,0xa0,0x03,0x85,0x40,0xbd,
        0x8c,0xc0,0x10,0xfb,0x2a,0x85,0x3c,0xbd,
        0x8c,0xc0,0x10,0xfb,0x25,0x3c,0x88,0xd0,
        0xec,0x28,0xc5,0x3d,0xd0,0xbe,0xa5,0x40,
        0xc5,0x41,0xd0,0xb8,0xb0,0xb7,0xa0,0x56,
        0x84,0x3c,0xbc,0x8c,0xc0,0x10,0xfb,0x59,
        0xd6,0x02,0xa4,0x3c,0x88,0x99,0x00,0x03,
        0xd0,0xee,0x84,0x3c,0xbc,0x8c,0xc0,0x10,
        0xfb,0x59,0xd6,0x02,0xa4,0x3c,0x91,0x26,
        0xc8,0xd0,0xef,0xbc,0x8c,0xc0,0x10,0xfb,
        0x59,0xd6,0x02,0xd0,0x87,0xa0,0x00,0xa2,
        0x56,0xca,0x30,0xfb,0xb1,0x26,0x5e,0x00,
        0x03,0x2a,0x5e,0x00,0x03,0x2a,0x91,0x26,
        0xc8,0xd0,0xee,0xe6,0x27,0xe6,0x3d,0xa5,
        0x3d,0xcd,0x00,0x08,0xa6,0x2b,0x90,0xdb,
        0x4c,0x01,0x08,0x00,0x00,0x00,0x00,0x00 ];
/*
    var diskII_13 = [
        0xa2,0x20,0xa0,0x00,0xa9,0x03,0x85,0x3c,
        0x18,0x88,0x98,0x24,0x3c,0xf0,0xf5,0x26,
        0x3c,0x90,0xf8,0xc0,0xd5,0xf0,0xed,0xca,
        0x8a,0x99,0x00,0x08,0xd0,0xe6,0x20,0x58,
        0xff,0xba,0xbd,0x00,0x01,0x48,0x0a,0x0a,
        0x0a,0x0a,0x85,0x2b,0xaa,0xa9,0xd0,0x48,
        0xbd,0x8e,0xc0,0xbd,0x8c,0xc0,0xbd,0x8a,
        0xc0,0xbd,0x89,0xc0,0xa0,0x50,0xbd,0x80,
        0xc0,0x98,0x29,0x03,0x0a,0x05,0x2b,0xaa,
        0xbd,0x81,0xc0,0xa9,0x56,0x20,0xa8,0xfc,
        0x88,0x10,0xeb,0xa9,0x03,0x85,0x27,0xa9,
        0x00,0x85,0x26,0x85,0x3d,0x18,0x08,0xbd,
        0x8c,0xc0,0x10,0xfb,0x49,0xd5,0xd0,0xf7,
        0xbd,0x8c,0xc0,0x10,0xfb,0xc9,0xaa,0xd0,
        0xf3,0xea,0xbd,0x8c,0xc0,0x10,0xfb,0xc9,
        0xb5,0xf0,0x09,0x28,0x90,0xdf,0x49,0xad,
        0xf0,0x1f,0xd0,0xd9,0xa0,0x03,0x84,0x2a,
        0xbd,0x8c,0xc0,0x10,0xfb,0x2a,0x85,0x3c,
        0xbd,0x8c,0xc0,0x10,0xfb,0x25,0x3c,0x88,
        0xd0,0xee,0x28,0xc5,0x3d,0xd0,0xbe,0xb0,
        0xbd,0xa0,0x9a,0x84,0x3c,0xbc,0x8c,0xc0,
        0x10,0xfb,0x59,0x00,0x08,0xa4,0x3c,0x88,
        0x99,0x00,0x08,0xd0,0xee,0x84,0x3c,0xbc,
        0x8c,0xc0,0x10,0xfb,0x59,0x00,0x08,0xa4,
        0x3c,0x91,0x26,0xc8,0xd0,0xef,0xbc,0x8c,
        0xc0,0x10,0xfb,0x59,0x00,0x08,0xd0,0x8d,
        0x60,0xa8,0xa2,0x00,0xb9,0x00,0x08,0x4a,
        0x3e,0xcc,0x03,0x4a,0x3e,0x99,0x03,0x85,
        0x3c,0xb1,0x26,0x0a,0x0a,0x0a,0x05,0x3c,
        0x91,0x26,0xc8,0xe8,0xe0,0x33,0xd0,0xe4,
        0xc6,0x2a,0xd0,0xde,0xcc,0x00,0x03,0xd0,
        0x03,0x4c,0x01,0x03,0x4c,0x2d,0xff,0xff
    ];
*/
    var diskII = diskII_16;

    _init();

    return {
        start: function disk2_start() {
            io.registerSwitches(this, LOC);
            return 0xc0 + slot;
        },
        end: function disk2_end() {
            return 0xc0 + slot;
        },
        ioSwitch: function disk2_ioSwitch(off, val) {
            return _access(off, val);
        },
        read: function disk2_read(page, off) {
            return diskII[off];
        },
        write: function disk2_write() {},
        reset: function disk2_reset() {
            if (_on) {
                _writeMode = false;
                _on = false;
                callbacks.driveLight(_drive, false);
            }
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
            _drives.forEach(function (drive, idx) {
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
                _drives[idx] = setDriveState(state);
            });
            _skip = state.skip;
            _latch = state.latch;
            _writeMode = state.writeMode;
            _on = state.on;
            _drive = state.drive;
            _cur = _drives[_drive - 1];
        },
        rwts: function disk2_rwts(disk, track, sector) {
            return _readSector(disk, track, sector);
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
            var v = disk.volume || 0xfe;
            // }

            cur.volume = v;
            cur.readOnly = readOnly;
            cur.format = fmt;
            var tracks = [];

            for (t = 0; t < data.length; t++) {
                var track = [];
                if (fmt === 'nib') {
                    track = data[t];
                } else {
                    for (s = 0; s < data[t].length; s++) {
                        var _s = 15 - s;
                        if (fmt === 'po') { // ProDOS Order
                            extend(track,
                                   _explodeSector(v, t, _PO[s], data[t][s]));
                        } else if (fmt === 'dsk') { // DOS Order
                            extend(track,
                                   _explodeSector(v, t, _DO[_s], data[t][_s]));
                        } else { // flat
                            extend(track,
                                   _explodeSector(v, t, s, data[t][s]));
                        }
                    }
                }
                tracks[t] = bytify(track);
            }
            cur.tracks = tracks;
            _updateDirty(_drive, false);
        },
        getJSON: function disk2_getJSON(drive, pretty) {
            return _json_encode(drive, pretty);
        },
        setJSON: function disk2_setJSON(drive, data) {
            _json_decode(drive, data);
            return true;
        },
        setBinary: function disk2_setBinary(drive, name, fmt, data) {
            var _cur = _drives[drive - 1];
            var tracks = [];
            var v = 254;
            if (fmt === 'do') {
                fmt = 'dsk';
            }
            _cur.readOnly = false;
            if (fmt === '2mg') {
                // Standard header size is 64 bytes. Make assumptions.
                var prefix = new Uint8Array(data.slice(0, 64));
                data = data.slice(64);

                // Check image format.
                // Sure, it's really 64 bits. But only 2 are actually used.
                switch (prefix[0xc]) {
                case 0:
                    fmt = 'dsk';
                    break;
                case 1:
                    fmt = 'po';
                    break;
                case 2:
                    fmt = 'nib';
                    break;
                default:  // Something hinky, assume 'dsk'
                    fmt = 'dsk';
                    break;
                }
                var flags =
                    prefix[0x10] | (prefix[0x11] << 8) |
                    (prefix[0x12] << 16) | (prefix[0x13] << 24);
                _cur.readOnly = (flags & 0x80000000) ? true : false;
                if (flags & 0x10) {
                    _cur.volume = flags & 0xff;
                } else {
                    _cur.volume = 254;
                }
            }
            for (var t = 0; t < 35; t++) {
                var track, off, d;
                if (fmt === 'nib') {
                    off = t * 0x1a00;
                    track = new Uint8Array(data.slice(off, off + 0x1a00));
                } else {
                    track = [];
                    for (var s = 0; s < 16; s++) {
                        var _s = 15 - s;
                        if (fmt == 'po') { // ProDOS Order
                            off = (16 * t + s) * 256;
                            d = new Uint8Array(data.slice(off, off + 256));
                            extend(track,
                                   _explodeSector(v, t, _PO[s], d));
                        } else if (fmt == 'dsk') { // DOS Order
                            off = (16 * t + _s) * 256;
                            d = new Uint8Array(data.slice(off, off + 256));
                            extend(track,
                                   _explodeSector(v, t, _DO[_s], d));
                        } else {
                            return false;
                        }
                    }
                }
                tracks[t] = bytify(track);
            }
            _cur.volume = v;
            _cur.format = fmt;
            _cur.tracks = tracks;

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
                        var sector = _readSector(drive, t, _DO[s]);
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
                        data += base64_encode(_readSector(drive, t, _DO[s]));
                    }
                }
            }
            return data;
        }
    };
}
