// From https://github.com/Klaus2m5/6502_65C02_functional_tests

import fs from 'fs';
import path from 'path';

export default function Test6502() {
    var data = fs.readFileSync(path.join(__dirname, '6502_functional_test.bin'));

    return {
        start: function() {
            return 0x00;
        },
        end: function() {
            return 0xff;
        },
        read: function(page, off) {
            return data[page << 8 | off];
        },
        write: function(page, off, val) {
            data[page << 8 | off] = val;
        }
    };
}
