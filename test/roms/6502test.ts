// From https://github.com/Klaus2m5/6502_65C02_functional_tests

import fs from 'fs';
import path from 'path';
import { PageHandler } from '../../js/cpu6502'
import { byte } from '../../js/types'

const data = fs.readFileSync(path.join(__dirname, '6502_functional_test.bin'));
export default class Test6502 implements PageHandler {
    private data: Buffer

    start = () => {
        return 0x00;
    }

    end = () => {
        return 0xff;
    }

    read = (page: byte, off: byte) => {
        return data[page << 8 | off];
    }

    write = (page: byte, off: byte, val: byte) => {
        data[page << 8 | off] = val;
    }
}
