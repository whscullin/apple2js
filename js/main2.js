import Prefs from './prefs';

import { driveLights, initUI, updateUI } from './ui/apple2';
import Printer from './ui/printer';

import DiskII from './cards/disk2';
import LanguageCard from './cards/langcard';
import Parallel from './cards/parallel';
import RAMFactor from './cards/ramfactor';
import SmartPort from './cards/smartport';
import Thunderclock from './cards/thunderclock';
import VideoTerm from './cards/videoterm';

import apple2_charset from './roms/apple2_char';
import apple2j_charset from './roms/apple2j_char';
import apple2lc_charset from './roms/apple2lc_char';
import pigfont_charset from './roms/pigfont_char';

import Apple2ROM from './roms/fpbasic';
import Apple2jROM from './roms/apple2j_char';
import IntBASIC from './roms/intbasic';
import OriginalROM from './roms/original';

import { Apple2 } from './apple2';

export * from './ui/apple2';

var prefs = new Prefs();
var romVersion = prefs.readPref('computer_type2');
var rom;
var characterRom = apple2_charset;
var sectors = 16;

switch (romVersion) {
case 'apple2':
    rom = new IntBASIC();
    break;
case 'apple213':
    rom = new IntBASIC();
    sectors = 13;
    break;
case 'original':
    rom = new OriginalROM();
    break;
case 'apple2jplus':
    rom = new Apple2jROM();
    characterRom = apple2j_charset;
    break;
case 'apple2pig':
    rom = new Apple2ROM();
    characterRom = pigfont_charset;
    break;
case 'apple2lc':
    rom = new Apple2ROM();
    characterRom = apple2lc_charset;
    break;
default:
    rom = new Apple2ROM();
}

var options = {
    screen: [],
    multiScreen: false,
    rom: rom,
    characterRom: characterRom,
    e: false,
    enhanced: false,
    cards: [],
    tick: updateUI
};

var canvas1 = document.getElementById('screen');
var canvas2 = document.getElementById('screen2');
var canvas3 = document.getElementById('screen3');
var canvas4 = document.getElementById('screen4');

options.screen[0] = canvas1.getContext('2d');
if (canvas4) {
    options.multiScreen = true;
    options.screen[1] = canvas2.getContext('2d');
    options.screen[2] = canvas3.getContext('2d');
    options.screen[3] = canvas4.getContext('2d');
} else if (canvas2) {
    options.multiScreen = true;
    options.screen[1] = options.screen[0];
    options.screen[2] = canvas2.getContext('2d');
    options.screen[3] = options.screen[2];
} else {
    options.screen[1] = options.screen[0];
    options.screen[2] = options.screen[0];
    options.screen[3] = options.screen[0];
}

var apple2 = new Apple2(options);
var cpu = apple2.getCPU();
var io = apple2.getIO();

var printer = new Printer('#printer-modal .paper');

var lc = new LanguageCard(io, rom);
var parallel = new Parallel(io, printer);
var videoTerm = new VideoTerm(io, options.screen[0]);
var slinky = new RAMFactor(io, 1024 * 1024);
var disk2 = new DiskII(io, driveLights, sectors);
var clock = new Thunderclock(io);
var smartport = new SmartPort(io, cpu, { block: true });

initUI(apple2, disk2, smartport, printer, false);

io.setSlot(0, lc);
io.setSlot(1, parallel);
io.setSlot(2, slinky);
io.setSlot(4, clock);
io.setSlot(3, videoTerm);
io.setSlot(6, disk2);
io.setSlot(7, smartport);

cpu.addPageHandler(lc);
