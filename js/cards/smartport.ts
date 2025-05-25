import { debug, toHex } from '../util';
import { rom as smartPortRom } from '../roms/cards/smartport';
import { Card, Restorable, byte, word, rom } from '../types';
import {
    BlockDisk,
    BlockFormat,
    MassStorageData,
    DiskFormat,
    Disk,
    MemoryBlockDisk,
    DRIVE_NUMBERS,
    BlockStorage,
} from '../formats/types';
import { CPU6502, flags } from '@whscullin/cpu6502';
import {
    create2MGFromBlockDisk,
    HeaderData,
    read2MGHeader,
} from '../formats/2mg';
import createBlockDisk from '../formats/block';
import { DriveNumber } from '../formats/types';
import { VDH_BLOCK, VDH_OFFSETS } from 'js/formats/prodos/vdh';
import { readFileName } from 'js/formats/prodos/utils';

const ID = 'SMARTPORT.J.S';

export interface SmartPortDiskState {
    disk: Disk;
    format: BlockFormat;
    blocks: Uint8Array[];
}

export interface SmartPortState {
    disks: Array<SmartPortDiskState | null>;
}

export interface SmartPortOptions {
    block: boolean;
}

export interface Callbacks {
    driveLight: (driveNo: DriveNumber, on: boolean) => void;
    dirty: (driveNo: DriveNumber, dirty: boolean) => void;
    label: (driveNo: DriveNumber, name?: string, side?: string) => void;
}

class Address {
    lo: byte;
    hi: byte;

    constructor(
        private cpu: CPU6502,
        a: byte,
        b?: byte
    ) {
        if (b === undefined) {
            this.lo = a & 0xff;
            this.hi = a >> 8;
        } else {
            this.lo = a;
            this.hi = b;
        }
    }

    loByte() {
        return this.lo;
    }

    hiByte() {
        return this.hi;
    }

    inc(val: byte) {
        return new Address(
            this.cpu,
            (((this.hi << 8) | this.lo) + val) & 0xffff
        );
    }

    readByte() {
        return this.cpu.read(this.hi, this.lo);
    }

    readWord() {
        const readLo = this.readByte();
        const readHi = this.inc(1).readByte();

        return (readHi << 8) | readLo;
    }

    readAddress() {
        const readLo = this.readByte();
        const readHi = this.inc(1).readByte();

        return new Address(this.cpu, readLo, readHi);
    }

    writeByte(val: byte) {
        this.cpu.write(this.hi, this.lo, val);
    }

    writeWord(val: word) {
        this.writeByte(val & 0xff);
        this.inc(1).writeByte(val >> 8);
    }

    writeAddress(val: Address) {
        this.writeByte(val.loByte());
        this.inc(1).writeByte(val.hiByte());
    }

    toString() {
        return '$' + toHex(this.hi) + toHex(this.lo);
    }
}

// ProDOS zero page locations

const COMMAND = 0x42;
const UNIT = 0x43;
const ADDRESS_LO = 0x44;
// const ADDRESS_HI = 0x45;
const BLOCK_LO = 0x46;
// const BLOCK_HI = 0x47;

const OK = 0x00;
// const IO_ERROR = 0x27;
const NO_DEVICE_CONNECTED = 0x28;
const WRITE_PROTECTED = 0x2b;
const DEVICE_OFFLINE = 0x2f;
// const VOLUME_DIRECTORY_NOT_FOUND = 0x45;
// const NOT_A_PRODOS_DISK = 0x52;
// const VOLUME_CONTROL_BLOCK_FULL = 0x55;
// const BAD_BUFFER_ADDRESS = 0x56;
// const DUPLICATE_VOLUME_ONLINE = 0x57;
const BUSY = 0x80;

// Type: Device
// $00: Memory Expansion Card (RAM disk)
// $01: 3.5" disk
// $02: ProFile-type hard disk
// $03: Generic SCSI
// $04: ROM disk
// $05: SCSI CD-ROM
// $06: SCSI tape or other SCSI sequential device
// $07: SCSI hard disk
const DEVICE_TYPE_SCSI_HD = 0x07;
// $08: Reserved
// $09: SCSI printer
// $0A: 5-1/4" disk
// $0B: Reserved
// $0C: Reserved
// $0D: Printer
// $0E: Clock
// $0F: Modem
export default class SmartPort
    implements Card, BlockStorage, Restorable<SmartPortState>
{
    private rom: rom;
    private disks: BlockDisk[] = [];
    private busy: boolean[] = [];
    private busyTimeout: ReturnType<typeof setTimeout>[] = [];
    private ext: DiskFormat[] = [];
    private metadata: Array<HeaderData | null> = [];
    private statusByte = 0x80;
    private xReg = 0x00;
    private yReg = 0x00;

    constructor(
        private cpu: CPU6502,
        private callbacks: Callbacks | null,
        options: SmartPortOptions
    ) {
        if (options?.block) {
            const dumbPortRom = new Uint8Array(smartPortRom);
            dumbPortRom[0x07] = 0x3c;
            this.rom = dumbPortRom;
            debug('DumbPort card');
        } else {
            debug('SmartPort card');
            this.rom = smartPortRom;
        }
    }

    private debug(..._args: unknown[]) {
        // debug.apply(this, arguments);
    }

    private driveLight(driveNo: DriveNumber) {
        if (!this.busy[driveNo]) {
            this.busy[driveNo] = true;
            this.callbacks?.driveLight(driveNo, true);
        }
        clearTimeout(this.busyTimeout[driveNo]);
        this.busyTimeout[driveNo] = setTimeout(() => {
            this.busy[driveNo] = false;
            this.callbacks?.driveLight(driveNo, false);
        }, 100);
    }

    /*
     * dumpBlock
     */

    async dumpBlock(driveNo: DriveNumber, blockNumber: number) {
        let result = '';
        let b;
        let jdx;

        const block = await this.disks[driveNo].read(blockNumber);

        for (let idx = 0; idx < 32; idx++) {
            result += toHex(idx << 4, 4) + ': ';
            for (jdx = 0; jdx < 16; jdx++) {
                b = block[idx * 16 + jdx];
                if (jdx === 8) {
                    result += ' ';
                }
                result += toHex(b) + ' ';
            }
            result += '        ';
            for (jdx = 0; jdx < 16; jdx++) {
                b = block[idx * 16 + jdx] & 0x7f;
                if (jdx === 8) {
                    result += ' ';
                }
                if (b >= 0x20 && b < 0x7f) {
                    result += String.fromCharCode(b);
                } else {
                    result += '.';
                }
            }
            result += '\n';
        }
        return result;
    }

    /*
     * getDeviceInfo
     */

    async getDeviceInfo(driveNo: DriveNumber): Promise<number> {
        if (this.disks[driveNo]) {
            const blocks = await this.disks[driveNo].blockCount();
            this.xReg = blocks & 0xff;
            this.yReg = blocks >> 8;

            return OK;
        } else {
            return NO_DEVICE_CONNECTED;
        }
    }

    /*
     * readBlock
     */

    async readBlock(
        driveNo: DriveNumber,
        blockNUmber: number,
        buffer: Address
    ): Promise<number> {
        this.debug(`read drive=${driveNo}`);
        this.debug(`read buffer=${buffer.toString()}`);
        this.debug(`read block=$${toHex(blockNUmber)}`);

        const blockCount = await this.disks[driveNo]?.blockCount();
        if (!blockCount) {
            debug('Drive', driveNo, 'is empty');
            return DEVICE_OFFLINE;
        }

        // debug('read', '\n' + dumpBlock(drive, block));
        this.driveLight(driveNo);

        const block = await this.disks[driveNo].read(blockNUmber);
        for (let idx = 0; idx < 512; idx++) {
            buffer.writeByte(block[idx]);
            buffer = buffer.inc(1);
        }

        return OK;
    }

    /*
     * writeBlock
     */

    async writeBlock(
        driveNo: DriveNumber,
        blockNUmber: number,
        buffer: Address
    ): Promise<number> {
        this.debug(`write drive=${driveNo}`);
        this.debug(`write buffer=${buffer.toString()}`);
        this.debug(`write block=$${toHex(blockNUmber)}`);

        if (!this.disks[driveNo]) {
            debug('Drive', driveNo, 'is empty');
            return DEVICE_OFFLINE;
        }

        if (this.disks[driveNo].readOnly) {
            debug('Drive', driveNo, 'is write protected');
            return WRITE_PROTECTED;
        }

        // debug('write', '\n' + dumpBlock(drive, block));
        this.driveLight(driveNo);

        const block = new Uint8Array(512);
        for (let idx = 0; idx < 512; idx++) {
            block[idx] = buffer.readByte();
            buffer = buffer.inc(1);
        }
        await this.disks[driveNo].write(blockNUmber, block);
        return 0;
    }

    /*
     * formatDevice
     */

    async formatDevice(driveNo: DriveNumber): Promise<number> {
        if (!this.disks[driveNo]) {
            debug('Drive', driveNo, 'is empty');
            return DEVICE_OFFLINE;
        }

        if (this.disks[driveNo].readOnly) {
            debug('Drive', driveNo, 'is write protected');
            return WRITE_PROTECTED;
        }

        const blockCount = await this.disks[driveNo].blockCount();

        for (let idx = 0; idx < blockCount; idx++) {
            const block = new Uint8Array(512);
            for (let jdx = 0; jdx < 512; jdx++) {
                block[jdx] = 0;
            }
            await this.disks[driveNo].write(idx, block);
        }

        return 0;
    }

    handleAsync(fn: () => Promise<number>): void {
        this.statusByte = BUSY;
        this.xReg = 0x00;
        this.yReg = 0x00;
        fn()
            .then((statusByte) => {
                this.statusByte = statusByte;
            })
            .catch((error) => {
                console.error(error);
                this.statusByte = DEVICE_OFFLINE;
            });
    }

    private access(off: byte, val: byte) {
        let result = 0x00;
        const readMode = val === undefined;

        switch (off & 0x8f) {
            case 0x80:
                if (readMode) {
                    result = 0;
                    for (let idx = 0; idx < this.disks.length; idx++) {
                        result <<= 1;
                        if (this.disks[idx]) {
                            result |= 0x01;
                        }
                    }
                }
                break;
            case 0x81:
                result = this.statusByte;
                break;
            case 0x82:
                result = this.xReg;
                break;
            case 0x83:
                result = this.yReg;
                break;
            case 0x84:
                result = this.statusByte ? 0x01 : 0x00;
                break;
        }

        return result;
    }

    /*
     * Interface
     */

    ioSwitch(off: byte, val: byte) {
        return this.access(off, val);
    }

    read(_page: byte, off: byte) {
        const state = this.cpu.getState();
        let cmd: number;
        let unit: number;
        let buffer: Address;
        let block: number;
        const blockOff = this.rom[0xff];
        const smartOff = blockOff + 3;

        if (off === blockOff && this.cpu.getSync()) {
            // Regular block device entry POINT
            this.debug('block device entry');
            cmd = this.cpu.read(0x00, COMMAND);
            unit = this.cpu.read(0x00, UNIT);
            const bufferAddr = new Address(this.cpu, ADDRESS_LO);
            const blockAddr = new Address(this.cpu, BLOCK_LO);
            const drive = unit & 0x80 ? 2 : 1;
            const driveSlot = (unit & 0x70) >> 4;

            buffer = bufferAddr.readAddress();
            block = blockAddr.readWord();

            this.debug(`cmd=${cmd}`);
            this.debug('unit=$' + toHex(unit));

            this.debug(`slot=${driveSlot} drive=${drive}`);
            this.debug(`buffer=${buffer.toString()} block=$${toHex(block)}`);

            switch (cmd) {
                case 0: // INFO
                    this.handleAsync(() => this.getDeviceInfo(drive));
                    break;

                case 1: // READ
                    this.handleAsync(() =>
                        this.readBlock(drive, block, buffer)
                    );
                    break;

                case 2: // WRITE
                    this.handleAsync(() =>
                        this.writeBlock(drive, block, buffer)
                    );
                    break;

                case 3: // FORMAT
                    this.handleAsync(() => this.formatDevice(drive));
                    break;
            }
        } else if (off === smartOff && this.cpu.getSync()) {
            this.debug('smartport entry');
            const stackAddr = new Address(this.cpu, state.sp + 1, 0x01);
            let blocks;

            const retVal = stackAddr.readAddress();

            this.debug(`return=${retVal.toString()}`);

            const cmdBlockAddr = retVal.inc(1);
            cmd = cmdBlockAddr.readByte();
            const cmdListAddr = cmdBlockAddr.inc(1).readAddress();

            this.debug(`cmd=${cmd}`);
            this.debug(`cmdListAddr=${cmdListAddr.toString()}`);

            stackAddr.writeAddress(retVal.inc(3));

            const parameterCount = cmdListAddr.readByte();
            unit = cmdListAddr.inc(1).readByte();
            const drive = unit ? 2 : 1;
            buffer = cmdListAddr.inc(2).readAddress();
            let status;

            this.debug(`parameterCount=${parameterCount}`);
            switch (cmd) {
                case 0x00: // INFO
                    status = cmdListAddr.inc(4).readByte();
                    this.debug(`info unit=${unit}`);
                    this.debug(`info buffer=${buffer.toString()}`);
                    this.debug(`info status=${status}`);
                    switch (unit) {
                        case 0:
                            switch (status) {
                                case 0:
                                    this.handleAsync(async () => {
                                        buffer.writeByte(2); // two devices
                                        buffer.inc(1).writeByte(1 << 6); // no interrupts
                                        buffer.inc(2).writeByte(0x2); // Other vendor
                                        buffer.inc(3).writeByte(0x0); // Other vendor
                                        buffer.inc(4).writeByte(0); // reserved
                                        buffer.inc(5).writeByte(0); // reserved
                                        buffer.inc(6).writeByte(0); // reserved
                                        buffer.inc(7).writeByte(0); // reserved
                                        this.xReg = 8;
                                        this.yReg = 0;
                                        return 0;
                                    });
                                    break;
                            }
                            break;
                        default: // Unit 1
                            switch (status) {
                                case 0:
                                    this.handleAsync(async () => {
                                        blocks =
                                            (await this.disks[
                                                unit
                                            ]?.blockCount()) ?? 0;
                                        buffer.writeByte(0xf0); // W/R Block device in drive
                                        buffer.inc(1).writeByte(blocks & 0xff); // 1600 blocks
                                        buffer
                                            .inc(2)
                                            .writeByte((blocks & 0xff00) >> 8);
                                        buffer
                                            .inc(3)
                                            .writeByte(
                                                (blocks & 0xff0000) >> 16
                                            );
                                        this.xReg = 4;
                                        this.yReg = 0;
                                        return 0;
                                    });
                                    break;
                                case 3:
                                    this.handleAsync(async () => {
                                        blocks =
                                            (await this.disks[
                                                unit
                                            ]?.blockCount()) ?? 0;
                                        buffer.writeByte(0xf0); // W/R Block device in drive
                                        buffer.inc(1).writeByte(blocks & 0xff); // Blocks low byte
                                        buffer
                                            .inc(2)
                                            .writeByte((blocks & 0xff00) >> 8); // Blocks middle byte
                                        buffer
                                            .inc(3)
                                            .writeByte(
                                                (blocks & 0xff0000) >> 16
                                            ); // Blocks high byte
                                        buffer.inc(4).writeByte(ID.length); // Vendor ID length
                                        for (
                                            let idx = 0;
                                            idx < ID.length;
                                            idx++
                                        ) {
                                            // Vendor ID
                                            buffer
                                                .inc(5 + idx)
                                                .writeByte(ID.charCodeAt(idx));
                                        }
                                        buffer
                                            .inc(21)
                                            .writeByte(DEVICE_TYPE_SCSI_HD); // Device Type
                                        buffer.inc(22).writeByte(0x0); // Device Subtype
                                        buffer.inc(23).writeWord(0x0101); // Version
                                        this.xReg = 24;
                                        this.yReg = 0;
                                        return OK;
                                    });
                            }
                            break;
                    }
                    state.a = 0;
                    state.s &= ~flags.C;
                    break;

                case 0x01: // READ BLOCK
                    block = cmdListAddr.inc(4).readWord();
                    this.handleAsync(() =>
                        this.readBlock(drive, block, buffer)
                    );
                    break;

                case 0x02: // WRITE BLOCK
                    block = cmdListAddr.inc(4).readWord();
                    this.handleAsync(() =>
                        this.writeBlock(drive, block, buffer)
                    );
                    break;

                case 0x03: // FORMAT
                    this.handleAsync(() => this.formatDevice(drive));
                    break;

                case 0x04: // CONTROL
                    break;

                case 0x05: // INIT
                    break;

                case 0x06: // OPEN
                    break;

                case 0x07: // CLOSE
                    break;

                case 0x08: // READ
                    break;

                case 0x09: // WRITE
                    break;
            }
        }

        this.cpu.setState(state);

        return this.rom[off];
    }

    write() {
        // not writable
    }

    async getState(): Promise<SmartPortState> {
        const disks = [];
        for (let diskNo = 0; diskNo < 2; diskNo++) {
            const diskState = async (disk: BlockDisk | null) => {
                let result: SmartPortDiskState | null = null;
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
            const disk = this.disks[diskNo];
            disks[diskNo] = await diskState(disk);
        }
        return {
            disks,
        };
    }

    async setState(state: SmartPortState) {
        for (const idx of DRIVE_NUMBERS) {
            const diskState = state.disks[idx];
            if (diskState) {
                const disk = new MemoryBlockDisk(
                    diskState.format,
                    diskState.disk.metadata,
                    diskState.disk.readOnly,
                    diskState.blocks
                );
                await this.setBlockDisk(idx, disk);
            } else {
                this.resetBlockDisk(idx);
            }
        }
    }

    async setBlockDisk(driveNo: DriveNumber, disk: BlockDisk) {
        this.disks[driveNo] = disk;
        this.ext[driveNo] = disk.format;
        const volumeName = await this.getVolumeName(driveNo);
        const name = volumeName || disk.metadata.name;

        this.callbacks?.label(driveNo, name);
    }

    async getBlockDisk(driveNo: DriveNumber): Promise<BlockDisk> {
        return this.disks[driveNo];
    }

    resetBlockDisk(driveNo: DriveNumber) {
        delete this.disks[driveNo];
    }

    async setBinary(
        driveNo: DriveNumber,
        name: string,
        fmt: BlockFormat,
        rawData: ArrayBuffer
    ): Promise<void> {
        let volume = 254;
        let readOnly = false;
        if (fmt === '2mg') {
            const header = read2MGHeader(rawData);
            this.metadata[driveNo] = header;
            const { bytes, offset } = header;
            volume = header.volume;
            readOnly = header.readOnly;
            rawData = rawData.slice(offset, offset + bytes);
        } else {
            this.metadata[driveNo] = null;
        }

        const options = {
            rawData,
            name,
            readOnly,
            volume,
        };

        this.ext[driveNo] = fmt;
        this.disks[driveNo] = createBlockDisk(fmt, options);
        name = (await this.getVolumeName(driveNo)) || name;

        this.callbacks?.label(driveNo, name);
    }

    async getBinary(drive: DriveNumber): Promise<MassStorageData | null> {
        if (!this.disks[drive]) {
            return null;
        }
        const disk = this.disks[drive];
        const ext = this.disks[drive].format;
        const { readOnly } = disk;
        const { name } = disk.metadata;
        let data: ArrayBuffer;
        if (ext === '2mg') {
            data = await create2MGFromBlockDisk(this.metadata[drive], disk);
        } else {
            const blockCount = await disk.blockCount();
            const byteArray = new Uint8Array(blockCount * 512);
            for (let idx = 0; idx < blockCount; idx++) {
                const block = await disk.read(idx);
                byteArray.set(block, idx * 512);
            }
            data = byteArray.buffer;
        }
        return {
            metadata: { name },
            ext,
            data,
            readOnly,
        };
    }

    async getVolumeName(driveNo: number): Promise<string | null> {
        const vdhBlock = await this.disks[driveNo]?.read(VDH_BLOCK);
        if (!vdhBlock?.buffer) {
            return null;
        }
        const dataView = new DataView(vdhBlock.buffer);

        const nameLength = dataView.getUint8(VDH_OFFSETS.NAME_LENGTH) & 0xf;
        const caseBits = dataView.getUint16(VDH_OFFSETS.CASE_BITS, true);
        return readFileName(
            dataView,
            VDH_OFFSETS.VOLUME_NAME,
            nameLength,
            caseBits
        );
    }
}
