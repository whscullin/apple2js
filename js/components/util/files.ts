import { Debugger } from '@whscullin/cpu6502';
import Disk2 from 'js/cards/disk2';
import SmartPort from 'js/cards/smartport';
import {
    BlockFormat,
    BLOCK_FORMATS,
    DISK_FORMATS,
    DriveNumber,
    FloppyFormat,
    FLOPPY_FORMATS,
    JSONDisk,
    MassStorage,
} from 'js/formats/types';
import { includes, word } from 'js/types';
import { initGamepad } from 'js/ui/gamepad';
import { HttpBlockDisk } from './http_block_disk';

type ProgressCallback = (current: number, total: number) => void;

/**
 * Routine to split a legacy hash into parts for disk loading
 *
 * @returns an padded array for 1 based indexing
 */
export const getHashParts = (hash: string) => {
    const parts = hash.match(/^#([^|]*)\|?(.*)$/) || ['', '', ''];
    return ['', parts[1], parts[2]];
};

/**
 * Update the location hash to reflect the current disk state, if possible
 *
 * @param parts a padded array with values starting at index 1
 */
export const setHashParts = (parts: string[]) => {
    window.location.hash = `#${parts[1]}` + (parts[2] ? `|${parts[2]}` : '');
};

export const getNameAndExtension = (url: string) => {
    const urlParts = url.split('/');
    const file = urlParts.pop() || url;
    const fileParts = file.split('.');
    const ext = fileParts.pop()?.toLowerCase() || '[none]';
    const name = decodeURIComponent(fileParts.join('.'));

    return { name, ext };
};

export const loadLocalFile = (
    storage: MassStorage<FloppyFormat | BlockFormat>,
    formats: typeof FLOPPY_FORMATS | typeof BLOCK_FORMATS | typeof DISK_FORMATS,
    driveNo: DriveNumber,
    file: File
) => {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = async function () {
            const result = this.result as ArrayBuffer;
            const { name, ext } = getNameAndExtension(file.name);
            if (includes(formats, ext)) {
                initGamepad();
                try {
                    await storage.setBinary(driveNo, name, ext, result);
                    resolve(true);
                } catch (error) {
                    console.error(error);
                    reject(`Unable to load ${name}`);
                }
            } else {
                reject(`Extension "${ext}" not recognized.`);
            }
        };
        fileReader.readAsArrayBuffer(file);
    });
};

/**
 * Local file loading routine. Allows a File object from a file
 * selection form element to be loaded.
 *
 * @param smartPort SmartPort object
 * @param driveNo Drive number
 * @param file Browser File object to load
 * @returns true if successful
 */
export const loadLocalBlockFile = (
    smartPort: SmartPort,
    driveNo: DriveNumber,
    file: File
) => {
    return loadLocalFile(smartPort, BLOCK_FORMATS, driveNo, file);
};

/**
 * Local file loading routine. Allows a File object from a file
 * selection form element to be loaded.
 *
 * @param disk2 Disk2 object
 * @param driveNo Drive number
 * @param file Browser File object to load
 * @returns true if successful
 */
export const loadLocalNibbleFile = (
    disk2: Disk2,
    driveNo: DriveNumber,
    file: File
) => {
    return loadLocalFile(disk2, FLOPPY_FORMATS, driveNo, file);
};

/**
 * JSON loading routine, loads a JSON file at the given URL. Requires
 * proper cross domain loading headers if the URL is not on the same server
 * as the emulator.
 *
 * @param disk2 Disk2 object
 * @param driveNo Drive number
 * @param url URL, relative or absolute to JSON file
 * @returns true if successful
 */
export const loadJSON = async (
    disk2: Disk2,
    driveNo: DriveNumber,
    url: string
) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error loading: ${response.statusText}`);
    }
    const data = (await response.json()) as JSONDisk;
    if (!includes(FLOPPY_FORMATS, data.type)) {
        throw new Error(`Type "${data.type}" not recognized.`);
    }
    disk2.setDisk(driveNo, data);
    initGamepad(data.gamepad);
};

export const loadHttpFile = async (
    url: string,
    signal?: AbortSignal,
    onProgress?: ProgressCallback
): Promise<ArrayBuffer> => {
    const response = await fetch(url, signal ? { signal } : {});
    if (!response.ok) {
        throw new Error(`Error loading: ${response.statusText}`);
    }
    if (!response.body) {
        throw new Error('Error loading: no body');
    }
    const reader = response.body.getReader();
    const contentLength = parseInt(
        response.headers.get('content-length') || '0',
        10
    );
    let received = 0;
    const chunks: Uint8Array[] = [];

    let result = await reader.read();
    onProgress?.(1, contentLength);
    while (!result.done) {
        chunks.push(result.value);
        received += result.value.length;
        onProgress?.(received, contentLength);
        result = await reader.read();
    }

    const data = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
    }

    return data.buffer;
};

/**
 * HTTP loading routine, loads a file at the given URL. Requires
 * proper cross domain loading headers if the URL is not on the same server
 * as the emulator.
 *
 * @param smartPort SmartPort object
 * @param driveNo Drive number
 * @param url URL, relative or absolute to JSON file
 * @returns true if successful
 */
export const loadHttpBlockFile = async (
    smartPort: SmartPort,
    driveNo: DriveNumber,
    url: string,
    signal?: AbortSignal,
    onProgress?: ProgressCallback
): Promise<boolean> => {
    const { name, ext } = getNameAndExtension(url);
    if (!includes(BLOCK_FORMATS, ext)) {
        throw new Error(`Extension "${ext}" not recognized.`);
    }
    const header = await fetch(url, { method: 'HEAD' });
    if (!header.ok) {
        throw new Error(`Error loading: ${header.statusText}`);
    }
    const contentLength = parseInt(
        header.headers.get('content-length') || '0',
        10
    );
    const hasByteRange = header.headers.get('accept-ranges') === 'byte';
    if (hasByteRange) {
        await smartPort.setBlockDisk(
            driveNo,
            new HttpBlockDisk(name, contentLength, url)
        );
    } else {
        const data = await loadHttpFile(url, signal, onProgress);
        await smartPort.setBinary(driveNo, name, ext, data);
        initGamepad();
    }

    return true;
};

/**
 * HTTP loading routine, loads a file at the given URL. Requires
 * proper cross domain loading headers if the URL is not on the same server
 * as the emulator.
 *
 * @param disk2 Disk2 object
 * @param driveNo Drive number
 * @param url URL, relative or absolute to JSON file
 * @returns true if successful
 */
export const loadHttpNibbleFile = async (
    disk2: Disk2,
    driveNo: DriveNumber,
    url: string,
    signal?: AbortSignal,
    onProgress?: ProgressCallback
) => {
    if (url.endsWith('.json')) {
        return loadJSON(disk2, driveNo, url);
    }
    const { name, ext } = getNameAndExtension(url);
    if (!includes(FLOPPY_FORMATS, ext)) {
        throw new Error(`Extension "${ext}" not recognized.`);
    }
    const data = await loadHttpFile(url, signal, onProgress);
    await disk2.setBinary(driveNo, name, ext, data);
    initGamepad();
    return loadHttpFile(url, signal, onProgress);
};

export const loadHttpUnknownFile = async (
    smartStorageBroker: SmartStorageBroker,
    driveNo: DriveNumber,
    url: string,
    signal?: AbortSignal,
    onProgress?: ProgressCallback
) => {
    // const data = await loadHttpFile(url, signal, onProgress);
    // const { name, ext } = getNameAndExtension(url);
    await smartStorageBroker.setUrl(driveNo, url, signal, onProgress);
    // await smartStorageBroker.setBinary(driveNo, name, ext, data);
};

export class SmartStorageBroker implements MassStorage<unknown> {
    constructor(
        private disk2: Disk2,
        private smartPort: SmartPort
    ) {}

    async setUrl(
        driveNo: DriveNumber,
        url: string,
        signal?: AbortSignal,
        onProgress?: ProgressCallback
    ) {
        const { name, ext } = getNameAndExtension(url);
        if (includes(DISK_FORMATS, ext)) {
            const head = await fetch(url, { method: 'HEAD' });
            const contentLength = parseInt(
                head.headers.get('content-length') || '0',
                10
            );
            if (contentLength >= 800 * 1024) {
                if (includes(BLOCK_FORMATS, ext)) {
                    await this.smartPort.setBlockDisk(
                        driveNo,
                        new HttpBlockDisk(name, contentLength, url)
                    );
                } else {
                    throw new Error(`Unable to load "${name}"`);
                }
                initGamepad();
                return;
            }
        }
        const data = await loadHttpFile(url, signal, onProgress);
        await this.setBinary(driveNo, name, ext, data);
    }

    async setBinary(
        driveNo: DriveNumber,
        name: string,
        ext: string,
        data: ArrayBuffer
    ): Promise<void> {
        if (includes(DISK_FORMATS, ext)) {
            if (data.byteLength >= 800 * 1024) {
                if (includes(BLOCK_FORMATS, ext)) {
                    await this.smartPort.setBinary(driveNo, name, ext, data);
                } else {
                    throw new Error(`Unable to load "${name}"`);
                }
            } else if (includes(FLOPPY_FORMATS, ext)) {
                await this.disk2.setBinary(driveNo, name, ext, data);
            } else {
                throw new Error(`Unable to load "${name}"`);
            }
        } else {
            throw new Error(`Extension "${ext}" not recognized.`);
        }
    }

    async getBinary(_drive: number) {
        return null;
    }
}

/**
 * Load binary file into memory.
 *
 * @param file File object to read into memory
 * @param address Address at which to start load
 * @param debug Debugger object
 * @returns resolves to true if successful
 */
export const loadLocalBinaryFile = (
    file: File,
    address: word,
    debug: Debugger
) => {
    return new Promise((resolve, _reject) => {
        const fileReader = new FileReader();
        fileReader.onload = function () {
            const result = this.result as ArrayBuffer;
            const bytes = new Uint8Array(result);
            debug.setMemory(address, bytes);
            resolve(true);
        };
        fileReader.readAsArrayBuffer(file);
    });
};
