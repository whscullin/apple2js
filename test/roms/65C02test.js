// From https://github.com/Klaus2m5/6502_65C02_functional_tests

import fs from 'fs';
import path from 'path';

export default function Test65C02() {
    var data = fs.readFileSync(path.join(__dirname, '65C02_extended_opcodes_test.bin'));

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
