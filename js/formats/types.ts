/* Copyright 2021 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

import type { bit, byte, memory, MemberOf } from '../types';
import type { GamepadConfiguration } from '../ui/gamepad';

export const DRIVE_NUMBERS = [1, 2] as const;
export type DriveNumber = MemberOf<typeof DRIVE_NUMBERS>;

/**
 * Arguments for the disk format processors.
 */

export interface DiskOptions {
    name: string
    volume: byte
    readOnly: boolean
    data?: memory[][]
    rawData?: ArrayBuffer
    blockVolume?: boolean
}

/**
 * Return value from disk format processors. Describes raw disk
 * data which the DiskII card can process.
 */

export interface Disk {
    format: DiskFormat
    name: string
    volume: byte
    readOnly: boolean
}

export interface NibbleDisk extends Disk {
    encoding: 'nibble'
    tracks: memory[]
}

export interface WozDisk extends Disk {
    encoding: 'woz'
    trackMap: number[]
    rawTracks: bit[][]
}

/**
 * File types supported by the disk format processors and
 * block devices.
 */

export const DISK_FORMATS = [
    '2mg',
    'd13',
    'do',
    'dsk',
    'hdv',
    'po',
    'nib',
    'woz'
] as const;

export type DiskFormat = MemberOf<typeof DISK_FORMATS>;

/**
 * Base format for JSON defined disks
 */

export class JSONDiskBase {
    type: DiskFormat
    name: string
    disk?: number
    category?: string
    writeProtected?: boolean
    volume: byte
    readOnly: boolean
    gamepad?: GamepadConfiguration
}

/**
 * JSON Disk format with base64 encoded tracks
 */

export interface Base64JSONDisk extends JSONDiskBase {
    encoding: 'base64'
    data: string[]
}

/**
 * JSON Disk format with byte array tracks
 */

export interface BinaryJSONDisk extends JSONDiskBase {
    encoding: 'binary'
    data: memory[][]
}

/**
 * General JSON Disk format
 */

export type JSONDisk = Base64JSONDisk | BinaryJSONDisk;

/**
 * Process Disk message payloads for worker
 */

export const ProcessBinaryType = 'processBinary';
export const ProcessJsonDiskType = 'processJsonDisk';
export const ProcessJsonType = 'processJson';

/** Binary disk file message */
export interface ProcessBinaryMessage {
    type: typeof ProcessBinaryType
    payload: {
        drive: DriveNumber
        fmt: DiskFormat
        options: DiskOptions
    }
}

/** Processed JSON file message (used for localStorage) */
export interface ProcessJsonDiskMessage {
    type: typeof ProcessJsonDiskType
    payload: {
        drive: DriveNumber
        jsonDisk: JSONDisk
    }
}

/** Raw JSON file message */
export interface ProcessJsonMessage {
    type: typeof ProcessJsonType
    payload: {
        drive: DriveNumber
        json: string
    }
}

export type FormatWorkerMessage =
    ProcessBinaryMessage |
    ProcessJsonDiskMessage |
    ProcessJsonMessage;

/**
 * Format work result message type
 */

export const DiskProcessedType = 'diskProcessed';

export interface DiskProcessedResponse {
    type: typeof DiskProcessedType
    payload: {
        drive: DriveNumber
        disk: Disk | null
    }
}

export type FormatWorkerResponse =
    DiskProcessedResponse

/**
 * Block device common interface
 */
export interface MassStorage {
    setBinary(drive: number, name: string, ext: DiskFormat, data: ArrayBuffer): boolean
}
