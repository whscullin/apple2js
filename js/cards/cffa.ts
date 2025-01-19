import type { byte, Card, Restorable, word } from '../types';
import { debug, toHex } from '../util';
import { rom as readOnlyRom } from '../roms/cards/cffa';
import {
    create2MGFromBlockDisk,
    HeaderData,
    read2MGHeader,
} from '../formats/2mg';
import createBlockDisk from '../formats/block';
import {
    BlockDisk,
    BlockFormat,
    Disk,
    DRIVE_NUMBERS,
    MassStorage,
    MassStorageData,
    MemoryBlockDisk,
} from 'js/formats/types';

const rom = new Uint8Array(readOnlyRom);

const COMMANDS = {
    ATACRead: 0x20,
    ATACWrite: 0x30,
    ATAIdentify: 0xec,
};

// CFFA Card Settings

const SETTINGS = {
    Max32MBPartitionsDev0: 0x800,
    Max32MBPartitionsDev1: 0x801,
    DefaultBootDevice: 0x802,
    DefaultBootPartition: 0x803,
    Reserved: 0x804, // 4 bytes
    WriteProtectBits: 0x808,
    MenuSnagMask: 0x809,
    MenuSnagKey: 0x80a,
    BootTimeDelayTenths: 0x80b,
    BusResetSeconds: 0x80c,
    CheckDeviceTenths: 0x80d,
    ConfigOptionBits: 0x80e,
    BlockOffsetDev0: 0x80f, // 3 bytes
    BlockOffsetDev1: 0x812, // 3 bytes
    Unused: 0x815,
};

// CFFA ATA Register Locations

const LOC = {
    ATADataHigh: 0x80,
    SetCSMask: 0x81,
    ClearCSMask: 0x82,
    WriteEEPROM: 0x83,
    NoWriteEEPROM: 0x84,
    ATADevCtrl: 0x86,
    ATAAltStatus: 0x86,
    ATADataLow: 0x88,
    AError: 0x89,
    ASectorCnt: 0x8a,
    ASector: 0x8b,
    ATACylinder: 0x8c,
    ATACylinderH: 0x8d,
    ATAHead: 0x8e,
    ATACommand: 0x8f,
    ATAStatus: 0x8f,
};

// ATA Status Bits

const STATUS = {
    BSY: 0x80, // Busy
    DRDY: 0x40, // Drive ready. 1 when ready
    DWF: 0x20, // Drive write fault. 1 when fault
    DSC: 0x10, // Disk seek complete. 1 when not seeking
    DRQ: 0x08, // Data request. 1 when ready to write
    CORR: 0x04, // Correct data. 1 on correctable error
    IDX: 0x02, // 1 once per revolution
    ERR: 0x01, // Error. 1 on error
};

// ATA Identity Block Locations

const IDENTITY = {
    SectorCountLow: 58,
    SectorCountHigh: 57,
};

export interface CFFADiskState {
    disk: Disk;
    format: BlockFormat;
    blocks: Uint8Array[];
}

export interface CFFAState {
    disks: Array<CFFADiskState | null>;
}

export default class CFFA
    implements Card, MassStorage<BlockFormat>, Restorable<CFFAState>
{
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

    private _curSector: Uint16Array = new Uint16Array(512);
    private _curWord = 0;

    // ATA Status registers

    private _status = STATUS.BSY;
    private _interruptsEnabled = false;
    private _altStatus = 0;
    private _error = 0;

    private _identity: Uint16Array[] = [
        new Uint16Array(512),
        new Uint16Array(512),
    ];

    // Disk data

    private _partitions: Array<BlockDisk | null> = [
        // Drive 1
        null,
        // Drive 2
        null,
    ];

    private _sectors: Uint16Array[][] = [[], []];
    private _name: string[] = [];
    private _metadata: Array<HeaderData | null> = [];

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

    private _debug(..._args: unknown[]) {
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
            if (status & STATUS[flag]) {
                statusArray.push(flag);
            }
        }
        return statusArray.join('|');
    }

    // Dump sector as hex and ascii

    private async _dumpSector(sector: number) {
        const partition = this._partitions[this._drive];
        if (!partition) {
            this._debug('dump sector volume not mounted');
            return;
        }
        const blockCount = await partition.blockCount();
        if (sector >= blockCount) {
            this._debug('dump sector out of range', sector);
            return;
        }
        const readSector = await partition.read(sector);
        for (let idx = 0; idx < 16; idx++) {
            const row = [];
            const charRow = [];
            for (let jdx = 0; jdx < 16; jdx++) {
                const val = readSector[idx * 16 + jdx];
                row.push(toHex(val, 4));
                const low = val & 0x7f;
                const hi = (val >> 8) & 0x7f;
                charRow.push(low > 0x1f ? String.fromCharCode(low) : '.');
                charRow.push(hi > 0x1f ? String.fromCharCode(hi) : '.');
            }
            this._debug(row.join(' '), ' ', charRow.join(''));
        }
    }

    private async readSector(sector: number): Promise<Uint16Array> {
        const partition = this._partitions[this._drive];
        if (!partition) {
            throw new Error('readSector no partition');
        }
        if (this._sectors[this._drive][sector] === undefined) {
            const readSector = await partition.read(sector);
            this._sectors[this._drive][sector] = new Uint16Array(
                readSector.buffer
            );
        }
        return this._sectors[this._drive][sector];
    }

    private handleAsync(fn: () => Promise<number>) {
        this._status = STATUS.BSY;
        fn()
            .then((status) => {
                this._status = status;
            })
            .catch((error) => {
                this._status = STATUS.ERR;
                console.error(error);
            });
    }

    // Card I/O access

    private _access(off: byte, val: byte) {
        const readMode = val === undefined;
        let retVal: byte | undefined = undefined;
        let sector: word;

        if (readMode) {
            retVal = 0;
            switch (off & 0x8f) {
                case LOC.ATADataHigh: // 0x00
                    retVal = this._dataHigh;
                    break;
                case LOC.SetCSMask: // 0x01
                    this._disableSignalling = true;
                    break;
                case LOC.ClearCSMask: // 0x02
                    this._disableSignalling = false;
                    break;
                case LOC.WriteEEPROM: // 0x03
                    this._writeEEPROM = true;
                    break;
                case LOC.NoWriteEEPROM: // 0x04
                    this._writeEEPROM = false;
                    break;
                case LOC.ATAAltStatus: // 0x06
                    retVal = this._altStatus;
                    break;
                case LOC.ATADataLow: // 0x08
                    this._dataHigh = this._curSector[this._curWord] >> 8;
                    retVal = this._curSector[this._curWord] & 0xff;
                    if (!this._disableSignalling) {
                        this._curWord++;
                    }
                    break;
                case LOC.AError: // 0x09
                    retVal = this._error;
                    break;
                case LOC.ASectorCnt: // 0x0A
                    retVal = this._sectorCnt;
                    break;
                case LOC.ASector: // 0x0B
                    retVal = this._sector;
                    break;
                case LOC.ATACylinder: // 0x0C
                    retVal = this._cylinder;
                    break;
                case LOC.ATACylinderH: // 0x0D
                    retVal = this._cylinderH;
                    break;
                case LOC.ATAHead: // 0x0E
                    retVal =
                        this._head |
                        (this._lba ? 0x40 : 0) |
                        (this._drive ? 0x10 : 0) |
                        0xa0;
                    break;
                case LOC.ATAStatus: // 0x0F
                    retVal = this._status;
                    this._debug('returning status', this._statusString(retVal));
                    break;
                default:
                    debug('read unknown soft switch', toHex(off));
            }

            if (off & 0x7) {
                // Anything but data high/low
                this._debug('read soft switch', toHex(off), toHex(retVal));
            }
        } else {
            if (off & 0x7) {
                // Anything but data high/low
                this._debug('write soft switch', toHex(off), toHex(val));
            }

            switch (off & 0x8f) {
                case LOC.ATADataHigh: // 0x00
                    this._dataHigh = val;
                    break;
                case LOC.SetCSMask: // 0x01
                    this._disableSignalling = true;
                    break;
                case LOC.ClearCSMask: // 0x02
                    this._disableSignalling = false;
                    break;
                case LOC.WriteEEPROM: // 0x03
                    this._writeEEPROM = true;
                    break;
                case LOC.NoWriteEEPROM: // 0x04
                    this._writeEEPROM = false;
                    break;
                case LOC.ATADevCtrl: // 0x06
                    this._debug('devCtrl:', toHex(val));
                    this._interruptsEnabled = val & 0x04 ? true : false;
                    this._debug(
                        'Interrupts',
                        this._interruptsEnabled ? 'enabled' : 'disabled'
                    );
                    if (val & 0x02) {
                        this._reset();
                    }
                    break;
                case LOC.ATADataLow: // 0x08
                    this._curSector[this._curWord] =
                        (this._dataHigh << 8) | val;
                    this._curWord++;
                    break;
                case LOC.ASectorCnt: // 0x0a
                    this._debug('setting sector count', val);
                    this._sectorCnt = val;
                    break;
                case LOC.ASector: // 0x0b
                    this._debug('setting sector', toHex(val));
                    this._sector = val;
                    break;
                case LOC.ATACylinder: // 0x0c
                    this._debug('setting cylinder', toHex(val));
                    this._cylinder = val;
                    break;
                case LOC.ATACylinderH: // 0x0d
                    this._debug('setting cylinder high', toHex(val));
                    this._cylinderH = val;
                    break;
                case LOC.ATAHead:
                    this._head = val & 0xf;
                    this._lba = val & 0x40 ? true : false;
                    this._drive = val & 0x10 ? 1 : 0;
                    this._debug(
                        'setting head',
                        toHex(val & 0xf),
                        'drive',
                        this._drive
                    );
                    if (!this._lba) {
                        console.error('CHS mode not supported');
                    }
                    break;
                case LOC.ATACommand: // 0x0f
                    this._debug('command:', toHex(val));
                    sector =
                        (this._head << 24) |
                        (this._cylinderH << 16) |
                        (this._cylinder << 8) |
                        this._sector;
                    void this._dumpSector(sector);

                    switch (val) {
                        case COMMANDS.ATAIdentify:
                            this._debug('ATA identify');
                            this._curSector = this._identity[this._drive];
                            this._curWord = 0;
                            break;
                        case COMMANDS.ATACRead:
                            this.handleAsync(async () => {
                                const partition = this._partitions[this._drive];
                                if (!partition) {
                                    return STATUS.ERR;
                                }
                                this._debug(
                                    'ATA read sector',
                                    toHex(this._cylinderH),
                                    toHex(this._cylinder),
                                    toHex(this._sector),
                                    sector
                                );
                                this._curSector = await this.readSector(sector);
                                return STATUS.DSC;
                            });
                            break;
                        case COMMANDS.ATACWrite:
                            this.handleAsync(async () => {
                                const partition = this._partitions[this._drive];
                                if (!partition) {
                                    return STATUS.ERR;
                                }
                                this._debug(
                                    'ATA write sector',
                                    toHex(this._cylinderH),
                                    toHex(this._cylinder),
                                    toHex(this._sector),
                                    sector
                                );
                                this._curSector = await this.readSector(sector);
                                this._curWord = 0;
                                return STATUS.DSC;
                            });
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
        return rom[((page - 0xc0) << 8) | off];
    }

    write(page: byte, off: byte, val: byte) {
        if (this._writeEEPROM) {
            this._debug('writing', toHex((page << 8) | off), toHex(val));
            rom[((page - 0xc0) << 8) | off] - val;
        }
    }

    async getState() {
        const disks = [];
        for (let diskNo = 0; diskNo < 2; diskNo++) {
            const diskState = async (disk: BlockDisk | null) => {
                let result: CFFADiskState | null = null;
                if (disk) {
                    const blocks = [];
                    const blockCount = await disk.blockCount();
                    for (let idx = 0; idx < blockCount; idx++) {
                        blocks.push(await disk.read(idx));
                    }
                    result = {
                        blocks,
                        format: disk.format,
                        disk: {
                            readOnly: disk.readOnly,
                            metadata: { ...disk.metadata },
                        },
                    };
                }
                return result;
            };
            const disk = this._partitions[diskNo];
            disks[diskNo] = await diskState(disk);
        }
        return {
            disks,
        };
    }

    async setState(state: CFFAState) {
        for (const idx of DRIVE_NUMBERS) {
            const diskState = state.disks[idx];
            if (diskState) {
                const disk = new MemoryBlockDisk(
                    diskState.format,
                    diskState.disk.metadata,
                    diskState.disk.readOnly,
                    diskState.blocks
                );
                await this.setBlockVolume(idx, disk);
            } else {
                this.resetBlockVolume(idx);
            }
        }
    }

    resetBlockVolume(drive: number) {
        drive = drive - 1;

        this._name[drive] = '';
        this._metadata[drive] = null;

        this._identity[drive][IDENTITY.SectorCountHigh] = 0;
        this._identity[drive][IDENTITY.SectorCountLow] = 0;

        if (drive) {
            rom[SETTINGS.Max32MBPartitionsDev1] = 0x0;
        } else {
            rom[SETTINGS.Max32MBPartitionsDev0] = 0x0;
        }
    }

    async setBlockVolume(drive: number, disk: BlockDisk): Promise<void> {
        drive = drive - 1;
        const partition = this._partitions[drive];
        if (!partition) {
            return;
        }

        const blockCount = await partition.blockCount();
        this._identity[drive][IDENTITY.SectorCountHigh] = blockCount & 0xffff;
        this._identity[drive][IDENTITY.SectorCountLow] = blockCount >> 16;

        this._name[drive] = disk.metadata.name;
        this._partitions[drive] = disk;

        if (drive) {
            rom[SETTINGS.Max32MBPartitionsDev1] = 0x1;
        } else {
            rom[SETTINGS.Max32MBPartitionsDev0] = 0x1;
        }
    }

    // Assign a raw disk image to a drive. Must be 2mg or raw PO image.

    setBinary(
        drive: number,
        name: string,
        format: BlockFormat,
        rawData: ArrayBuffer
    ): Promise<void> {
        const volume = 254;
        const readOnly = false;

        if (format === '2mg') {
            const headerData = read2MGHeader(rawData);
            const { bytes, offset } = headerData;
            this._metadata[drive - 1] = headerData;
            rawData = rawData.slice(offset, offset + bytes);
        } else {
            this._metadata[drive - 1] = null;
        }
        const options = {
            rawData,
            name,
            volume,
            readOnly,
        };
        const disk = createBlockDisk(format, options);

        return this.setBlockVolume(drive, disk);
    }

    async getBinary(drive: number): Promise<MassStorageData | null> {
        drive = drive - 1;
        const blockDisk = this._partitions[drive];
        if (!blockDisk) {
            return null;
        }
        const { readOnly } = blockDisk;
        const { name } = blockDisk.metadata;
        let ext: '2mg' | 'po';
        let data: ArrayBuffer;
        if (this._metadata[drive]) {
            ext = '2mg';
            data = await create2MGFromBlockDisk(
                this._metadata[drive - 1],
                blockDisk
            );
        } else {
            ext = 'po';
            const blockCount = await blockDisk.blockCount();
            const dataArray = new Uint8Array(blockCount * 512);
            for (let idx = 0; idx < blockCount; idx++) {
                dataArray.set(await blockDisk.read(idx), idx * 512);
            }
            data = dataArray.buffer;
        }
        return {
            metadata: { name },
            ext,
            data,
            readOnly,
        };
    }
}
