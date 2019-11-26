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

import { debug, toHex } from '../util';
import { rom } from '../roms/cards/cffa';
import disk from '../../disks/totalreplay.2mg';

export default function SmartPort() {

    var LOC = {
        ATADataHigh:   0x80,
        SetCSMask:     0x81,
        ClearCSMask:   0x82,
        WriteEEPROM:   0x83,
        NoWriteEEPROM: 0x84,
        ATADevCtrl:    0x86,
        ATAAltStatus:  0x86,
        ATADataLow:    0x88,
        AError:        0x89,
        ASectorCnt:    0x8a,
        ASector:       0x8b,
        ATACylinder:   0x8c,
        ATACylinderH:  0x8d,
        ATAHead:       0x8e,
        ATACommand:    0x8f,
        ATAStatus:     0x8f
    };

    var STATUS = {
        BSY:  0x80, // Busy
        DRDY: 0x40, // Drive ready. 1 when ready
        DWF:  0x20, // Drive write fault. 1 when fault
        DSC:  0x10, // Disk seek complete. 1 when not seeking
        DRQ:  0x08, // Data request. 1 when ready to write
        CORR: 0x04, // Correct data. 1 on correctable error
        IDX:  0x02, // 1 once per revolution
        ERR:  0x01  // Error. 1 on error
    };

    var _disableSignalling = false;
    var _interruptsEnabled = false;
    var _writeEEPROM = false;

    var _sectorCnt = 0;
    var _sector = 0;
    var _cylinder = 0;
    var _cylinderH = 0;
    var _head = 0;

    var _dataHigh = 0;
    var _dataLow = 0;

    var _status = STATUS.BSY;
    var _altStatus = 0;
    var _error = 0;

    var _disk = null;

    function _init() {
        debug('CFFA');
        fetch('dist/' + disk).then(function(result) {
            return result.arrayBuffer();
        }).then(function(data) {
            debug('loaded', data, 'bytes');
            _disk = data;
            _status = STATUS.DRDY;
        }).catch(console.error);
    }

    function _debug() {
        debug.apply(this, arguments);
    }

    function _reset() {
        _debug('reset');
    }

    function _access(off, val) {
        var readMode = val === undefined;
        var retVal = readMode ? 0 : undefined;

        if (readMode) {
            switch (off & 0x8f) {
            case LOC.ATADataHigh:   // 0x00
                retVal = _dataHigh;
                break;
            case LOC.SetCSMask:     // 0x01
                _disableSignalling = true;
                break;
            case LOC.ClearCSMask:   // 0x02
                _disableSignalling = false;
                break;
            case LOC.WriteEEPROM:   // 0x03
                _writeEEPROM = true;
                break;
            case LOC.NoWriteEEPROM: // 0x04
                _writeEEPROM = false;
                break;
            case LOC.ATAAltStatus:  // 0x06
                retVal = _altStatus;
                break;
            case LOC.ATADataLow:    // 0x08
                retVal = _dataLow;
                break;
            case LOC.AError:        // 0x09
                retVal = _error;
                break;
            case LOC.ASectorCnt:    // 0x0A
                retVal = _sectorCnt;
                break;
            case LOC.ASector:       // 0x0B
                retVal = _sector;
                break;
            case LOC.ATACylinder:   // 0x0C
                retVal = _cylinder;
                break;
            case LOC.ATACylinderH:  // 0x0D
                retVal = _cylinderH;
                break;
            case LOC.ATAHead:       // 0x0E
                retVal = _head;
                break;
            case LOC.ATAStatus:     // 0x0F
                retVal = _status;
                debug('returning status', toHex(retVal));
                break;
            default:
                debug('read unknown soft switch', toHex(off));
            }
            _debug('read soft switch', toHex(off), toHex(retVal));
        } else {
            switch (off & 0x8f) {
            case LOC.ATADataHigh:   // 0x00
                _dataHigh = val;
                break;
            case LOC.SetCSMask:     // 0x01
                _disableSignalling = true;
                break;
            case LOC.ClearCSMask:   // 0x02
                _disableSignalling = false;
                break;
            case LOC.WriteEEPROM:   // 0x03
                _writeEEPROM = true;
                break;
            case LOC.NoWriteEEPROM: // 0x04
                _writeEEPROM = false;
                break;
            case LOC.ATADevCtrl:    // 0x06
                _debug('devCtrl:', toHex(val));
                _interruptsEnabled = (val & 0x04) ? true : false;
                _debug('Interrupts', _interruptsEnabled ? 'enabled' : 'disabled');
                if (val & 0x02) {
                    _reset();
                }
                break;
            case LOC.ATADataLow:    // 0x08
                _dataLow = val;
                break;
            case LOC.ASectorCnt:    // 0x0a
                _sectorCnt = val;
                break;
            case LOC.ASector:       // 0x0b
                _sector = val;
                break;
            case LOC.ATACylinder:   // 0x0c
                _cylinder = val;
                break;
            case LOC.ATACylinderH:  // 0x0d
                _cylinderH = val;
                break;
            case LOC.ATAHead:       // 0x0e
                _head = val;
                break;
            case LOC.ATACommand:    // 0x0f
                _debug('command:', toHex(val));
                break;
            default:
                debug('write unknown soft switch', toHex(off), toHex(val));
            }
            _debug('write soft switch', toHex(off), toHex(val));
        }

        return retVal;
    }

    _init();

    return {
        ioSwitch: function (off, val) {
            return _access(off, val);
        },
        read: function(page, off) {
            return rom[(page - 0xc0) << 8 | off];
        },
        write: function(page, off, val) {
            if (_writeEEPROM) {
                _debug('writing', toHex(page << 8 | off), toHex(val));
                rom[(page - 0xc0) << 8 | off] - val;
            }
        }
    };
}
