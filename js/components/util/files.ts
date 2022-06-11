import { includes } from 'js/types';
import { initGamepad } from 'js/ui/gamepad';
import {
    BlockFormat,
    BLOCK_FORMATS,
    DISK_FORMATS,
    DriveNumber,
    JSONDisk,
    MassStorage,
    NibbleFormat,
    NIBBLE_FORMATS,
} from 'js/formats/types';
import Disk2 from 'js/cards/disk2';
import SmartPort from 'js/cards/smartport';

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
    storage: MassStorage<NibbleFormat|BlockFormat>,
    formats: typeof NIBBLE_FORMATS | typeof BLOCK_FORMATS | typeof DISK_FORMATS,
    number: DriveNumber,
    file: File,
) => {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = function () {
            const result = this.result as ArrayBuffer;
            const { name, ext } = getNameAndExtension(file.name);
            if (includes(formats, ext)) {
                initGamepad();
                if (storage.setBinary(number, name, ext, result)) {
                    resolve(true);
                } else {
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
 * @param number Drive number
 * @param file Browser File object to load
 * @returns true if successful
 */
export const loadLocalBlockFile = (smartPort: SmartPort, number: DriveNumber, file: File) => {
    return loadLocalFile(smartPort, BLOCK_FORMATS, number, file);
};

/**
 * Local file loading routine. Allows a File object from a file
 * selection form element to be loaded.
 *
 * @param disk2 Disk2 object
 * @param number Drive number
 * @param file Browser File object to load
 * @returns true if successful
 */
export const loadLocalNibbleFile = (disk2: Disk2, number: DriveNumber, file: File) => {
    return loadLocalFile(disk2, NIBBLE_FORMATS, number, file);
};

/**
 * JSON loading routine, loads a JSON file at the given URL. Requires
 * proper cross domain loading headers if the URL is not on the same server
 * as the emulator.
 *
 * @param disk2 Disk2 object
 * @param number Drive number
 * @param url URL, relative or absolute to JSON file
 * @returns true if successful
 */
export const loadJSON = async (
    disk2: Disk2,
    number: DriveNumber,
    url: string,
) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error loading: ${response.statusText}`);
    }
    const data = await response.json() as JSONDisk;
    if (!includes(NIBBLE_FORMATS, data.type)) {
        throw new Error(`Type "${data.type}" not recognized.`);
    }
    disk2.setDisk(number, data);
    initGamepad(data.gamepad);
};

export const loadHttpFile = async (
    url: string,
    onProgress?: ProgressCallback
): Promise<ArrayBuffer> => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error loading: ${response.statusText}`);
    }
    if (!response.body) {
        throw new Error('Error loading: no body');
    }
    const reader = response.body.getReader();
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
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
 * @param number Drive number
 * @param url URL, relative or absolute to JSON file
 * @returns true if successful
 */
export const loadHttpBlockFile = async (
    smartPort: SmartPort,
    number: DriveNumber,
    url: string,
    onProgress?: ProgressCallback
): Promise<boolean> => {
    const { name, ext } = getNameAndExtension(url);
    if (!includes(BLOCK_FORMATS, ext)) {
        throw new Error(`Extension "${ext}" not recognized.`);
    }
    const data = await loadHttpFile(url, onProgress);
    smartPort.setBinary(number, name, ext, data);
    initGamepad();

    return true;
};

/**
 * HTTP loading routine, loads a file at the given URL. Requires
 * proper cross domain loading headers if the URL is not on the same server
 * as the emulator.
 *
 * @param disk2 Disk2 object
 * @param number Drive number
 * @param url URL, relative or absolute to JSON file
 * @returns true if successful
 */
export const loadHttpNibbleFile = async (
    disk2: Disk2,
    number: DriveNumber,
    url: string,
    onProgress?: ProgressCallback
) => {
    if (url.endsWith('.json')) {
        return loadJSON(disk2, number, url);
    }
    const { name, ext } = getNameAndExtension(url);
    if (!includes(NIBBLE_FORMATS, ext)) {
        throw new Error(`Extension "${ext}" not recognized.`);
    }
    const data = await loadHttpFile(url, onProgress);
    disk2.setBinary(number, name, ext, data);
    initGamepad();
    return loadHttpFile(url, onProgress);
};

export const loadHttpUnknownFile = async (
    unknownStorage: UnknownStorage,
    number: DriveNumber,
    url: string,
    onProgress?: ProgressCallback,
) => {
    const data = await loadHttpFile(url, onProgress);
    const { name, ext } = getNameAndExtension(url);
    unknownStorage.setBinary(number, name, ext, data);
};

export class UnknownStorage implements MassStorage<unknown> {
    constructor(private disk2: Disk2, private smartPort: SmartPort) {}

    setBinary(drive: DriveNumber, name: string, ext: string, data: ArrayBuffer): boolean {
        if (includes(DISK_FORMATS, ext)) {
            if (data.byteLength >= 800 * 1024) {
                if (includes(BLOCK_FORMATS, ext)) {
                    this.smartPort.setBinary(drive, name, ext, data);
                } else {
                    throw new Error(`Unable to load "${name}"`);
                }
            } else if (includes(NIBBLE_FORMATS, ext)) {
                this.disk2.setBinary(drive, name, ext, data);
            } else {
                throw new Error(`Unable to load "${name}"`);
            }
        } else {
            throw new Error(`Extension "${ext}" not recognized.`);
        }
        return true;
    }
}
