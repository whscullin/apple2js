import CPU6502 from './cpu6502';
import Test6502 from './6502test';
import Test65C02 from './65C02test';
import { toHex } from './util';

var SYMBOLS = {};
var cpu;
var trace = [];
var lastPC = 0;
var done = false;
function traceCB() {
    var pc = cpu.getPC();
    done = lastPC == pc;
    lastPC = pc;
    var line = cpu.dumpRegisters() + ' ' + cpu.dumpPC(undefined, SYMBOLS);
    trace.push(line);
    if (trace.length > 1000) {
        trace.shift();
    }
}

window.test6502 = function test6502() {
    cpu = new CPU6502();
    var test = new Test6502();
    cpu.addPageHandler(test);
    cpu.setPC(0x400);
    do {
        cpu.stepCyclesDebug(1000, traceCB);
    } while (!done);

    if (lastPC == 0x3469) {
        window.alert('6502 Success!');
    } else {
        window.alert('Failed! ' + toHex(lastPC));
    }
};

window.test65C02 = function test65C02() {
    cpu = new CPU6502({'65C02': true});
    var test = new Test65C02();
    cpu.addPageHandler(test);
    cpu.setPC(0x400);
    do {
        cpu.stepCyclesDebug(1000, traceCB);
    } while (!done);
    if (lastPC == 0x24f1) {
        window.alert('65C02 Success!');
    } else {
        window.alert('Failed! ' + toHex(lastPC));
    }
};
