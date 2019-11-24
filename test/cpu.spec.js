
import CPU6502 from '../js/cpu6502';
import Test6502 from './roms/6502test';
import Test65C02 from './roms/65C02test';

import { toHex } from '../js/util';

describe.skip('CPU', function () {
    var cpu;
    var lastPC = 0;
    var done = false;

    function traceCB() {
        var pc = cpu.getPC();
        done = lastPC == pc;
        lastPC = pc;
    }

    describe('6502', function () {
        it('completes the test ROM', function () {
            cpu = new CPU6502();
            var test = new Test6502();
            cpu.addPageHandler(test);
            cpu.setPC(0x400);

            do {
                cpu.stepCyclesDebug(1000, traceCB);
            } while (!done);

            expect(toHex(lastPC)).toEqual(toHex(0x3469));
        });
    });

    describe('65C02', function () {
        it('completes the test ROM', function () {
            cpu = new CPU6502({'65C02': true});
            var test = new Test65C02();
            cpu.addPageHandler(test);
            cpu.setPC(0x400);

            do {
                cpu.stepCyclesDebug(1000, traceCB);
            } while (!done);

            expect(toHex(lastPC)).toEqual(toHex(0x24f1));
        });
    });
});
