import Prefs from './prefs';

import { driveLights, initUI, updateUI } from './ui/apple2';
import Printer from './ui/printer';

import DiskII from './cards/disk2';
import Parallel from './cards/parallel';
import RAMFactor from './cards/ramfactor';
import SmartPort from './cards/smartport';
import Thunderclock from './cards/thunderclock';

import apple2e_charset from './roms/apple2e_char';
import apple2enh_charset from './roms/apple2enh_char';
import rmfont_charset from './roms/rmfont_char';

import Apple2eROM from './roms/apple2e';
import Apple2eEnhancedROM from './roms/apple2enh';

import { Apple2 } from './apple2';

export * from './ui/apple2';

var prefs = new Prefs();
var romVersion = prefs.readPref('computer_type2e');
var enhanced = false;
var rom;
var characterRom = apple2e_charset;

switch (romVersion) {
    case 'apple2e':
        rom = new Apple2eROM();
        break;
    case 'apple2rm':
        rom = new Apple2eEnhancedROM();
        characterRom = rmfont_charset;
        enhanced = true;
        break;
    default:
        rom = new Apple2eEnhancedROM();
        characterRom = apple2enh_charset;
        enhanced = true;
}

var options = {
    gl: prefs.readPref('gl_canvas') === 'true',
    canvas: document.getElementById('screen'),
    rom: rom,
    characterRom: characterRom,
    e: true,
    enhanced: enhanced,
    cards: [],
    tick: updateUI
};

export var apple2 = new Apple2(options);
var io = apple2.getIO();
var cpu = apple2.getCPU();

var printer = new Printer('#printer-modal .paper');

var parallel = new Parallel(printer);
var slinky = new RAMFactor(1024 * 1024);
var disk2 = new DiskII(io, driveLights);
var clock = new Thunderclock();
var smartport = new SmartPort(cpu, { block: !enhanced });

initUI(apple2, disk2, smartport, printer, options.e);

io.setSlot(1, parallel);
io.setSlot(2, slinky);
io.setSlot(5, clock);
io.setSlot(6, disk2);
io.setSlot(7, smartport);


