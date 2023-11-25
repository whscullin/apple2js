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
import { SupportedSectors } from './formats/types';

const prefs = new Prefs();
const romVersion = prefs.readPref('computer_type2');
let rom: string;
let characterRom: string;
let sectors: SupportedSectors = 16;
let keyboardLayout: string;

switch (romVersion) {
    case 'apple2':
        rom = 'intbasic';
        characterRom = 'apple2_char';
        keyboardLayout = 'apple2';
        break;
    case 'apple213':
        rom = 'intbasic';
        characterRom = 'apple2_char';
        sectors = 13;
        keyboardLayout = 'apple2';
        break;
    case 'original':
        rom = 'original';
        characterRom = 'apple2_char';
        keyboardLayout = 'apple2';
        break;
    case 'apple2jplus':
        rom = 'apple2j';
        characterRom = 'apple2j_char';
        keyboardLayout = 'apple2';
        break;
    case 'apple2pig':
        rom = 'fpbasic';
        characterRom = 'pigfont_char';
        keyboardLayout = 'apple2';
        break;
    case 'apple2lc':
        rom = 'fpbasic';
        characterRom = 'apple2lc_char';
        keyboardLayout = 'apple2';
        break;
    case 'pravetz82':
        rom = 'pravetz82';
        characterRom = 'pravetz82_char';
        keyboardLayout = 'pravetz82';
        break;
    default:
        rom = 'fpbasic';
        characterRom = 'apple2_char';
        keyboardLayout = 'apple2';
}

const options = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    canvas: document.querySelector<HTMLCanvasElement>('#screen')!,
    gl: prefs.readPref('gl_canvas', 'true') === 'true',
    rom,
    characterRom,
    e: false,
    enhanced: false,
    tick: updateUI,
};

export const apple2 = new Apple2(options);
apple2.ready
    .then(() => {
        const cpu = apple2.getCPU();
        const io = apple2.getIO();

        const printer = new Printer('#printer-modal .paper');

        const lc = new LanguageCard(apple2.getROM());
        const parallel = new Parallel(printer);
        const videoTerm = new VideoTerm();
        const slinky = new RAMFactor(1024 * 1024);
        const disk2 = new DiskII(io, driveLights, sectors);
        const clock = new Thunderclock();
        const smartport = new SmartPort(cpu, null, { block: true });

        io.setSlot(0, lc);
        io.setSlot(1, parallel);
        io.setSlot(2, slinky);
        io.setSlot(4, clock);
        io.setSlot(3, videoTerm);
        io.setSlot(6, disk2);
        io.setSlot(7, smartport);

        cpu.addPageHandler(lc);

        initUI(apple2, disk2, smartport, printer, false, keyboardLayout);
    })
    .catch(console.error);
