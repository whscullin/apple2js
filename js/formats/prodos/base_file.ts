import { word } from 'js/types';
import { ProDOSVolume } from '.';

export interface ProDOSFileData {
    data: Uint8Array;
    address: word;
}

export abstract class ProDOSFile {
    constructor(public volume: ProDOSVolume) {}

    abstract read(): Uint8Array;
    abstract write(data: Uint8Array): void;
}
