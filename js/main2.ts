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

import { Apple2 } from './apple2';

const prefs = new Prefs();
const romVersion = prefs.readPref('computer_type2');
let rom: string;
let characterRom: string;
let sectors = 16;

switch (romVersion) {
    case 'apple2':
        rom = 'intbasic';
        characterRom = 'apple2_char';
        break;
    case 'apple213':
        rom = 'intbasic';
        characterRom = 'apple2_char';
        sectors = 13;
        break;
    case 'original':
        rom = 'original';
        characterRom = 'apple2_char';
        break;
    case 'apple2jplus':
        rom = 'apple2j';
        characterRom = 'apple2j_char';
        break;
    case 'apple2pig':
        rom = 'fpbasic';
        characterRom = 'pigfont_char';
        break;
    case 'apple2lc':
        rom = 'fpbasic';
        characterRom = 'apple2lc_char';
        break;
    default:
        rom = 'fpbasic';
        characterRom = 'apple2_char';
}

const options = {
    canvas: document.querySelector<HTMLCanvasElement>('#screen')!,
    gl: prefs.readPref('gl_canvas', 'true') === 'true',
    rom,
    characterRom,
    e: false,
    enhanced: false,
    tick: updateUI
};

export const apple2 = new Apple2(options);
apple2.ready.then(() => {
    const cpu = apple2.getCPU();
    const io = apple2.getIO();

    const printer = new Printer('#printer-modal .paper');

    const lc = new LanguageCard(apple2.getROM());
    const parallel = new Parallel(printer);
    const videoTerm = new VideoTerm();
    const slinky = new RAMFactor(1024 * 1024);
    const disk2 = new DiskII(io, driveLights, sectors);
    const clock = new Thunderclock();
    const smartport = new SmartPort(cpu, { block: true });

    io.setSlot(0, lc);
    io.setSlot(1, parallel);
    io.setSlot(2, slinky);
    io.setSlot(4, clock);
    io.setSlot(3, videoTerm);
    io.setSlot(6, disk2);
    io.setSlot(7, smartport);

    cpu.addPageHandler(lc);

    initUI(apple2, disk2, smartport, printer, false);
}).catch(console.error);
