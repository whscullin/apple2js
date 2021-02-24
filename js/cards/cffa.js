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
import _2MG from '../formats/2mg';
import { ProDOSVolume } from '../formats/prodos';
import BlockVolume from '../formats/block';
import { dump } from '../formats/prodos/utils';

export default function CFFA() {
    var COMMANDS = {
        ATACRead:    0x20,
        ATACWrite:   0x30,
        ATAIdentify: 0xEC
    };

    // CFFA Card Settings

    var SETTINGS = {
        Max32MBPartitionsDev0: 0x800,
        Max32MBPartitionsDev1: 0x801,
        DefaultBootDevice:     0x802,
        DefaultBootPartition:  0x803,
        Reserved:              0x804, // 4 bytes
        WriteProtectBits:      0x808,
        MenuSnagMask:          0x809,
        MenuSnagKey:           0x80A,
        BootTimeDelayTenths:   0x80B,
        BusResetSeconds:       0x80C,
        CheckDeviceTenths:     0x80D,
        ConfigOptionBits:      0x80E,
        BlockOffsetDev0:       0x80F, // 3 bytes
        BlockOffsetDev1:       0x812, // 3 bytes
        Unused:                0x815
    };

    // CFFA ATA Register Locations

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

    // ATA Status Bits

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

    // ATA Identity Block Locations

    var IDENTITY = {
        SectorCountLow:  58,
        SectorCountHigh: 57
    };

    // CFFA internal Flags

    var _disableSignalling = false;
    var _writeEEPROM = true;

    var _lba = true;

    // LBA/CHS registers

    var _sectorCnt = 1;
    var _sector = 0;
    var _cylinder = 0;
    var _cylinderH = 0;
    var _head = 0;
    var _drive = 0;

    // CFFA Data High register

    var _dataHigh = 0;

    // Current Sector

    var _curSector = [];
    var _curWord = 0;

    // ATA Status registers

    var _interruptsEnabled = false;
    var _altStatus = 0;
    var _error = 0;

    var _identity = [[], []];

    // Disk data

    var _partitions = [
        // Drive 1
        [],
        // Drive 2
        []
    ];

    var _sectors = [
        // Drive 1
        [],
        // Drive 2
        []
    ];

    function _init() {
        debug('CFFA');

        for (var idx = 0; idx < 0x100; idx++) {
            _identity[0][idx] = 0;
            _identity[1][idx] = 0;
        }

        rom[SETTINGS.Max32MBPartitionsDev0] = 0x1;
        rom[SETTINGS.Max32MBPartitionsDev1] = 0x0;
        rom[SETTINGS.BootTimeDelayTenths] = 0x5; // 0.5 seconds
        rom[SETTINGS.CheckDeviceTenths] = 0x5; // 0.5 seconds
    }

    // Verbose debug method

    function _debug() {
        // debug.apply(this, arguments);
    }

    function _reset() {
        _debug('reset');

        _sectorCnt = 1;
        _sector = 0;
        _cylinder = 0;
        _cylinderH = 0;
        _head = 0;
        _drive = 0;

        _dataHigh = 0;
    }

    // Convert status register into readable string

    function _statusString(status) {
        var statusArray = [];
        for (var flag in STATUS) {
            if(status & STATUS[flag]) {
                statusArray.push(flag);
            }
        }
        return statusArray.join('|');
    }

    // Dump sector as hex and ascii

    function _dumpSector(sector) {
        if (sector >= _sectors[_drive].length) {
            _debug('dump sector out of range', sector);
            return;
        }
        for (var idx = 0; idx < 16; idx++) {
            var row = [];
            var charRow = [];
            for (var jdx = 0; jdx < 16; jdx++) {
                var val = _sectors[_drive][sector][idx * 16 + jdx];
                row.push(toHex(val, 4));
                var low = val & 0x7f;
                var hi = val >> 8 & 0x7f;
                charRow.push(low > 0x1f ? String.fromCharCode(low) : '.');
                charRow.push(hi > 0x1f ? String.fromCharCode(hi) : '.');
            }
            _debug(row.join(' '), ' ', charRow.join(''));
        }
    }

    // Card I/O access

    function _access(off, val) {
        var readMode = val === undefined;
        var retVal = readMode ? 0 : undefined;
        var sector;

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
                    _dataHigh = _curSector[_curWord] >> 8;
                    retVal = _curSector[_curWord] & 0xff;
                    if (!_disableSignalling) {
                        _curWord++;
                    }
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
                    retVal = _head | (_lba ? 0x40 : 0) | (_drive ? 0x10 : 0) | 0xA0;
                    break;
                case LOC.ATAStatus:     // 0x0F
                    retVal = _sectors[_drive].length > 0 ? STATUS.DRDY | STATUS.DSC : 0;
                    _debug('returning status', _statusString(retVal));
                    break;
                default:
                    debug('read unknown soft switch', toHex(off));
            }

            if (off & 0x7) { // Anything but data high/low
                _debug('read soft switch', toHex(off), toHex(retVal));
            }
        } else {
            if (off & 0x7) { // Anything but data high/low
                _debug('write soft switch', toHex(off), toHex(val));
            }

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
                    _curSector[_curWord] = _dataHigh << 8 | val;
                    _curWord++;
                    break;
                case LOC.ASectorCnt:    // 0x0a
                    _debug('setting sector count', val);
                    _sectorCnt = val;
                    break;
                case LOC.ASector:       // 0x0b
                    _debug('setting sector', toHex(val));
                    _sector = val;
                    break;
                case LOC.ATACylinder:   // 0x0c
                    _debug('setting cylinder', toHex(val));
                    _cylinder = val;
                    break;
                case LOC.ATACylinderH:  // 0x0d
                    _debug('setting cylinder high', toHex(val));
                    _cylinderH = val;
                    break;
                case LOC.ATAHead:
                    _head = val & 0xf;
                    _lba = val & 0x40 ? true : false;
                    _drive = val & 0x10 ? 1 : 0;
                    _debug('setting head', toHex(val & 0xf), 'drive', _drive);
                    if (!_lba) {
                        console.error('CHS mode not supported');
                    }
                    break;
                case LOC.ATACommand:    // 0x0f
                    _debug('command:', toHex(val));
                    sector = _head << 24 | _cylinderH << 16 | _cylinder << 8 | _sector;
                    _dumpSector(sector);

                    switch (val) {
                        case COMMANDS.ATAIdentify:
                            _debug('ATA identify');
                            _curSector = _identity[_drive];
                            _curWord = 0;
                            break;
                        case COMMANDS.ATACRead:
                            _debug('ATA read sector', toHex(_cylinderH), toHex(_cylinder), toHex(_sector), sector);
                            _curSector = _sectors[_drive][sector];
                            _curWord = 0;
                            break;
                        case COMMANDS.ATACWrite:
                            _debug('ATA write sector', toHex(_cylinderH), toHex(_cylinder), toHex(_sector), sector);
                            _curSector = _sectors[_drive][sector];
                            _curWord = 0;
                            break;
                        default:
                            debug('unknown command', toHex(val));
                    }
                    break;
                default:
                    debug('write unknown soft switch', toHex(off), toHex(val));
            }
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
        },

        getState() {
            // TODO CFFA State
            return {};
        },

        setState(_) {},

        // Assign a raw disk image to a drive. Must be 2mg or raw PO image.

        setBinary: function(drive, name, ext, rawData) {
            drive = drive - 1;
            var disk;
            var options = {
                rawData,
                name
            };

            if (ext === '2mg') {
                disk = new _2MG(options);
            } else {
                disk = new BlockVolume(options);
            }

            // Convert 512 byte blocks into 256 word sectors
            _sectors[drive] = disk.blocks.map(function(block) {
                return new Uint16Array(block.buffer);
            });

            _identity[drive][IDENTITY.SectorCountHigh] = _sectors[0].length & 0xffff;
            _identity[drive][IDENTITY.SectorCountLow] = _sectors[0].length >> 16;

            var prodos = new ProDOSVolume(disk);
            dump(prodos);

            _partitions[drive] = prodos;

            if (drive) {
                rom[SETTINGS.Max32MBPartitionsDev1] = 0x1;
            } else {
                rom[SETTINGS.Max32MBPartitionsDev0] = 0x1;
            }
        }
    };
}
