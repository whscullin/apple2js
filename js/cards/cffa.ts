import type { byte, Card, Restorable } from '../types';
import { debug, toHex } from '../util';
import { rom as readOnlyRom } from '../roms/cards/cffa';
import { read2MGHeader } from '../formats/2mg';
import { ProDOSVolume } from '../formats/prodos';
import createBlockDisk from '../formats/block';
import { dump } from '../formats/prodos/utils';
import {
    BlockDisk,
    BlockFormat,
    ENCODING_BLOCK,
    MassStorage,
} from 'js/formats/types';

const rom = new Uint8Array(readOnlyRom);

const COMMANDS = {
    ATACRead:    0x20,
    ATACWrite:   0x30,
    ATAIdentify: 0xEC
};

// CFFA Card Settings

const SETTINGS = {
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

const LOC = {
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

const STATUS = {
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

const IDENTITY = {
    SectorCountLow:  58,
    SectorCountHigh: 57
};

export interface CFFAState {
    disks: Array<BlockDisk | null>
}

export default class CFFA implements Card, MassStorage, Restorable<CFFAState> {

    // CFFA internal Flags

    private _disableSignalling = false;
    private _writeEEPROM = true;

    private _lba = true;

    // LBA/CHS registers

    private _sectorCnt = 1;
    private _sector = 0;
    private _cylinder = 0;
    private _cylinderH = 0;
    private _head = 0;
    private _drive = 0;

    // CFFA Data High register

    private _dataHigh = 0;

    // Current Sector

    private _curSector: Uint16Array | number[];
    private _curWord = 0;

    // ATA Status registers

    private _interruptsEnabled = false;
    private _altStatus = 0;
    private _error = 0;

    private _identity: number[][] = [[], []];

    // Disk data

    private _partitions: Array<ProDOSVolume|null> = [
        // Drive 1
        null,
        // Drive 2
        null
    ];

    private _sectors: Uint16Array[][] = [
        // Drive 1
        [],
        // Drive 2
        []
    ];

    constructor() {
        debug('CFFA');

        for (let idx = 0; idx < 0x100; idx++) {
            this._identity[0][idx] = 0;
            this._identity[1][idx] = 0;
        }

        rom[SETTINGS.Max32MBPartitionsDev0] = 0x1;
        rom[SETTINGS.Max32MBPartitionsDev1] = 0x0;
        rom[SETTINGS.BootTimeDelayTenths] = 0x5; // 0.5 seconds
        rom[SETTINGS.CheckDeviceTenths] = 0x5; // 0.5 seconds
    }

    // Verbose debug method

    private _debug(..._args: any[]) {
        // debug.apply(this, arguments);
    }

    private _reset() {
        this._debug('reset');

        this._sectorCnt = 1;
        this._sector = 0;
        this._cylinder = 0;
        this._cylinderH = 0;
        this._head = 0;
        this._drive = 0;

        this._dataHigh = 0;
    }

    // Convert status register into readable string

    private _statusString(status: byte) {
        const statusArray = [];
        let flag: keyof typeof STATUS;
        for (flag in STATUS) {
            if(status & STATUS[flag]) {
                statusArray.push(flag);
            }
        }
        return statusArray.join('|');
    }

    // Dump sector as hex and ascii

    private _dumpSector(sector: number) {
        if (sector >= this._sectors[this._drive].length) {
            this._debug('dump sector out of range', sector);
            return;
        }
        for (let idx = 0; idx < 16; idx++) {
            const row = [];
            const charRow = [];
            for (let jdx = 0; jdx < 16; jdx++) {
                const val = this._sectors[this._drive][sector][idx * 16 + jdx];
                row.push(toHex(val, 4));
                const low = val & 0x7f;
                const hi = val >> 8 & 0x7f;
                charRow.push(low > 0x1f ? String.fromCharCode(low) : '.');
                charRow.push(hi > 0x1f ? String.fromCharCode(hi) : '.');
            }
            this._debug(row.join(' '), ' ', charRow.join(''));
        }
    }

    // Card I/O access

    private _access(off: byte, val: byte) {
        const readMode = val === undefined;
        let retVal;
        let sector;

        if (readMode) {
            retVal = 0;
            switch (off & 0x8f) {
                case LOC.ATADataHigh:   // 0x00
                    retVal = this._dataHigh;
                    break;
                case LOC.SetCSMask:     // 0x01
                    this._disableSignalling = true;
                    break;
                case LOC.ClearCSMask:   // 0x02
                    this._disableSignalling = false;
                    break;
                case LOC.WriteEEPROM:   // 0x03
                    this._writeEEPROM = true;
                    break;
                case LOC.NoWriteEEPROM: // 0x04
                    this._writeEEPROM = false;
                    break;
                case LOC.ATAAltStatus:  // 0x06
                    retVal = this._altStatus;
                    break;
                case LOC.ATADataLow:    // 0x08
                    this._dataHigh = this._curSector[this._curWord] >> 8;
                    retVal = this._curSector[this._curWord] & 0xff;
                    if (!this._disableSignalling) {
                        this._curWord++;
                    }
                    break;
                case LOC.AError:        // 0x09
                    retVal = this._error;
                    break;
                case LOC.ASectorCnt:    // 0x0A
                    retVal = this._sectorCnt;
                    break;
                case LOC.ASector:       // 0x0B
                    retVal = this._sector;
                    break;
                case LOC.ATACylinder:   // 0x0C
                    retVal = this._cylinder;
                    break;
                case LOC.ATACylinderH:  // 0x0D
                    retVal = this._cylinderH;
                    break;
                case LOC.ATAHead:       // 0x0E
                    retVal = this._head | (this._lba ? 0x40 : 0) | (this._drive ? 0x10 : 0) | 0xA0;
                    break;
                case LOC.ATAStatus:     // 0x0F
                    retVal = this._sectors[this._drive].length > 0 ? STATUS.DRDY | STATUS.DSC : 0;
                    this._debug('returning status', this._statusString(retVal));
                    break;
                default:
                    debug('read unknown soft switch', toHex(off));
            }

            if (off & 0x7) { // Anything but data high/low
                this._debug('read soft switch', toHex(off), toHex(retVal));
            }
        } else {
            if (off & 0x7) { // Anything but data high/low
                this._debug('write soft switch', toHex(off), toHex(val));
            }

            switch (off & 0x8f) {
                case LOC.ATADataHigh:   // 0x00
                    this._dataHigh = val;
                    break;
                case LOC.SetCSMask:     // 0x01
                    this._disableSignalling = true;
                    break;
                case LOC.ClearCSMask:   // 0x02
                    this._disableSignalling = false;
                    break;
                case LOC.WriteEEPROM:   // 0x03
                    this._writeEEPROM = true;
                    break;
                case LOC.NoWriteEEPROM: // 0x04
                    this._writeEEPROM = false;
                    break;
                case LOC.ATADevCtrl:    // 0x06
                    this._debug('devCtrl:', toHex(val));
                    this._interruptsEnabled = (val & 0x04) ? true : false;
                    this._debug('Interrupts', this._interruptsEnabled ? 'enabled' : 'disabled');
                    if (val & 0x02) {
                        this._reset();
                    }
                    break;
                case LOC.ATADataLow:    // 0x08
                    this._curSector[this._curWord] = this._dataHigh << 8 | val;
                    this._curWord++;
                    break;
                case LOC.ASectorCnt:    // 0x0a
                    this._debug('setting sector count', val);
                    this._sectorCnt = val;
                    break;
                case LOC.ASector:       // 0x0b
                    this._debug('setting sector', toHex(val));
                    this._sector = val;
                    break;
                case LOC.ATACylinder:   // 0x0c
                    this._debug('setting cylinder', toHex(val));
                    this._cylinder = val;
                    break;
                case LOC.ATACylinderH:  // 0x0d
                    this._debug('setting cylinder high', toHex(val));
                    this._cylinderH = val;
                    break;
                case LOC.ATAHead:
                    this._head = val & 0xf;
                    this._lba = val & 0x40 ? true : false;
                    this._drive = val & 0x10 ? 1 : 0;
                    this._debug('setting head', toHex(val & 0xf), 'drive', this._drive);
                    if (!this._lba) {
                        console.error('CHS mode not supported');
                    }
                    break;
                case LOC.ATACommand:    // 0x0f
                    this._debug('command:', toHex(val));
                    sector = this._head << 24 | this._cylinderH << 16 | this._cylinder << 8 | this._sector;
                    this._dumpSector(sector);

                    switch (val) {
                        case COMMANDS.ATAIdentify:
                            this._debug('ATA identify');
                            this._curSector = this._identity[this._drive];
                            this._curWord = 0;
                            break;
                        case COMMANDS.ATACRead:
                            this._debug('ATA read sector', toHex(this._cylinderH), toHex(this._cylinder), toHex(this._sector), sector);
                            this._curSector = this._sectors[this._drive][sector];
                            this._curWord = 0;
                            break;
                        case COMMANDS.ATACWrite:
                            this._debug('ATA write sector', toHex(this._cylinderH), toHex(this._cylinder), toHex(this._sector), sector);
                            this._curSector = this._sectors[this._drive][sector];
                            this._curWord = 0;
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

    ioSwitch(off: byte, val: byte) {
        return this._access(off, val);
    }

    read(page: byte, off: byte) {
        return rom[(page - 0xc0) << 8 | off];
    }

    write(page: byte, off: byte, val: byte) {
        if (this._writeEEPROM) {
            this._debug('writing', toHex(page << 8 | off), toHex(val));
            rom[(page - 0xc0) << 8 | off] - val;
        }
    }

    getState() {
        return {
            disks: this._partitions.map(
                (partition) => {
                    let result: BlockDisk | null = null;
                    if (partition) {
                        const disk: BlockDisk = partition.disk();
                        result = {
                            blocks: disk.blocks.map(
                                (block) => new Uint8Array(block)
                            ),
                            encoding: ENCODING_BLOCK,
                            readOnly: disk.readOnly,
                            name: disk.name,
                        };
                    }
                    return result;
                }
            )
        };
    }

    setState(state: CFFAState) {
        state.disks.forEach(
            (disk, idx) => {
                if (disk) {
                    this.setBlockVolume(idx + 1, disk);
                } else {
                    this.resetBlockVolume(idx + 1);
                }
            }
        );
    }

    resetBlockVolume(drive: number) {
        drive = drive - 1;

        this._sectors[drive] = [];

        this._identity[drive][IDENTITY.SectorCountHigh] = 0;
        this._identity[drive][IDENTITY.SectorCountLow] = 0;

        if (drive) {
            rom[SETTINGS.Max32MBPartitionsDev1] = 0x0;
        } else {
            rom[SETTINGS.Max32MBPartitionsDev0] = 0x0;
        }
    }

    setBlockVolume(drive: number, disk: BlockDisk) {
        drive = drive - 1;

        // Convert 512 byte blocks into 256 word sectors
        this._sectors[drive] = disk.blocks.map(function(block) {
            return new Uint16Array(block.buffer);
        });

        this._identity[drive][IDENTITY.SectorCountHigh] = this._sectors[0].length & 0xffff;
        this._identity[drive][IDENTITY.SectorCountLow] = this._sectors[0].length >> 16;

        const prodos = new ProDOSVolume(disk);
        dump(prodos);

        this._partitions[drive] = prodos;

        if (drive) {
            rom[SETTINGS.Max32MBPartitionsDev1] = 0x1;
        } else {
            rom[SETTINGS.Max32MBPartitionsDev0] = 0x1;
        }
        return true;
    }

    // Assign a raw disk image to a drive. Must be 2mg or raw PO image.

    setBinary(drive: number, name: string, ext: BlockFormat, rawData: ArrayBuffer) {
        const volume = 254;
        const readOnly = false;

        if (ext === '2mg') {
            const { bytes, offset } = read2MGHeader(rawData);
            rawData = rawData.slice(offset, offset + bytes);
        }
        const options = {
            rawData,
            name,
            volume,
            readOnly
        };
        const disk = createBlockDisk(options);

        return this.setBlockVolume(drive, disk);
    }
}
