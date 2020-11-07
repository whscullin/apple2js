// From https://github.com/Klaus2m5/6502_65C02_functional_tests

import fs from 'fs';
import path from 'path';
import { PageHandler } from '../../js/cpu6502';
import { byte } from '../../js/types';

export default class Test65C02 implements PageHandler {
    private data: Buffer

    constructor() {
        this.data = fs.readFileSync(path.join(__dirname, '65C02_extended_opcodes_test.bin'));
    }

    start = function() {
        return 0x00;
    }

    end = function() {
        return 0xff;
    }

    read = function(page: byte, off: byte) {
        return this.data[page << 8 | off];
    }

    write = function(page: byte, off: byte, val: byte) {
        this.data[page << 8 | off] = val;
    }
}
