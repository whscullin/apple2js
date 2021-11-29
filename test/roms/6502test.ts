// From https://github.com/Klaus2m5/6502_65C02_functional_tests

import fs from 'fs';
import path from 'path';
import { MemoryPages, byte } from '../../js/types';

export default class Test6502 implements MemoryPages {
    private data: Buffer;

    constructor() {
        this.data = fs.readFileSync(path.join(__dirname, '6502_functional_test.bin'));
    }

    start = () => {
        return 0x00;
    };

    end = () => {
        return 0xff;
    };

    read = (page: byte, off: byte) => {
        return this.data[page << 8 | off];
    };

    write = (page: byte, off: byte, val: byte) => {
        this.data[page << 8 | off] = val;
    };
}
