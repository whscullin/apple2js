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
import Apple2jROM from './roms/apple2j';
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
    canvas: document.getElementById('screen'),
    gl: prefs.readPref('gl_canvas', 'true') === 'true',
    screen: [],
    rom: rom,
    characterRom: characterRom,
    e: false,
    enhanced: false,
    cards: [],
    tick: updateUI
};

export var apple2 = new Apple2(options);
var cpu = apple2.getCPU();
var io = apple2.getIO();

var printer = new Printer('#printer-modal .paper');

var lc = new LanguageCard(rom);
var parallel = new Parallel(printer);
var videoTerm = new VideoTerm();
var slinky = new RAMFactor(1024 * 1024);
var disk2 = new DiskII(io, driveLights, sectors);
var clock = new Thunderclock();
var smartport = new SmartPort(cpu, { block: true });

initUI(apple2, disk2, smartport, printer, false);

io.setSlot(0, lc);
io.setSlot(1, parallel);
io.setSlot(2, slinky);
io.setSlot(4, clock);
io.setSlot(3, videoTerm);
io.setSlot(6, disk2);
io.setSlot(7, smartport);

cpu.addPageHandler(lc);
