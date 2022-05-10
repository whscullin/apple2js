import { includes } from 'js/types';
import { initGamepad } from 'js/ui/gamepad';
import {
    DriveNumber,
    JSONDisk,
    NIBBLE_FORMATS
} from 'js/formats/types';
import DiskII from 'js/cards/disk2';

/**
 * Routine to split a legacy hash into parts for disk loading
 *
 * @returns an padded array for 1 based indexing
 */
export const getHashParts = () => {
    const parts = window.location.hash.match(/^#([^|]*)\|?(.*)$/) || ['', '', ''];
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

/**
 * Local file loading routine. Allows a File object from a file
 * selection form element to be loaded.
 *
 * @param disk2 Disk2 object
 * @param number Drive number
 * @param file Browser File object to load
 * @returns true if successful
 */
export const loadLocalFile = (
    disk2: DiskII,
    number: DriveNumber,
    file: File,
) => {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = function () {
            const result = this.result as ArrayBuffer;
            const parts = file.name.split('.');
            const ext = parts.pop()?.toLowerCase() || '[none]';
            const name = parts.join('.');

            if (includes(NIBBLE_FORMATS, ext)) {
                if (result.byteLength >= 800 * 1024) {
                    reject(`Unable to load ${name}`);
                } else {
                    initGamepad();
                    if (disk2.setBinary(number, name, ext, result)) {
                        resolve(true);
                    } else {
                        reject(`Unable to load ${name}`);
                    }
                }
            } else {
                reject(`Extension ${ext} not recognized.`);
            }
        };
        fileReader.readAsArrayBuffer(file);
    });
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
export const loadJSON = async (disk2: DiskII, number: DriveNumber, url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error loading: ${response.statusText}`);
    }
    const data: JSONDisk = await response.json();
    if (!includes(NIBBLE_FORMATS, data.type)) {
        throw new Error(`Type ${data.type} not recognized.`);
    }
    disk2.setDisk(number, data);
    initGamepad(data.gamepad);
};

/**
 * HTTP loading routine, loads a file at the given URL. Requires
 * proper cross domain loading headers if the URL is not on the same server
 * as the emulator. Only supports nibble based formats at the moment.
 *
 * @param disk2 Disk2 object
 * @param number Drive number
 * @param url URL, relative or absolute to JSON file
 * @returns true if successful
 */
export const loadHttpFile = async (
    disk2: DiskII,
    number: DriveNumber,
    url: string,
) => {
    if (url.endsWith('.json')) {
        return loadJSON(disk2, number, url);
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error loading: ${response.statusText}`);
    }
    const reader = response.body!.getReader();
    let received = 0;
    const chunks: Uint8Array[] = [];

    let result = await reader.read();
    while (!result.done) {
        chunks.push(result.value);
        received += result.value.length;
        result = await reader.read();
    }

    const data = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
    }

    const urlParts = url.split('/');
    const file = urlParts.pop()!;
    const fileParts = file.split('.');
    const ext = fileParts.pop()?.toLowerCase() || '[none]';
    const name = decodeURIComponent(fileParts.join('.'));
    if (!includes(NIBBLE_FORMATS, ext)) {
        throw new Error(`Extension ${ext} not recognized.`);
    }
    disk2.setBinary(number, name, ext, data);
    initGamepad();
};
