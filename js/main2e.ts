import Prefs from './prefs';

import { driveLights, initUI, updateUI } from './ui/apple2';
import Printer from './ui/printer';
import { MouseUI } from './ui/mouse';

import DiskII from './cards/disk2';
import Parallel from './cards/parallel';
import RAMFactor from './cards/ramfactor';
import SmartPort from './cards/smartport';
import Thunderclock from './cards/thunderclock';
import Mouse from './cards/mouse';

import { Apple2 } from './apple2';

const prefs = new Prefs();
const romVersion = prefs.readPref('computer_type2e');
let enhanced = false;
let rom: string;
let characterRom: string;

switch (romVersion) {
    case 'apple2e':
        rom = 'apple2e';
        characterRom = 'apple2e_char';
        break;
    case 'apple2rm':
        rom = 'apple2e';
        characterRom = 'rmfont_char';
        enhanced = true;
        break;
    case 'apple2ex':
        rom = 'apple2ex';
        characterRom = 'apple2enh_char';
        enhanced = true;
        break;
    default:
        rom = 'apple2enh';
        characterRom = 'apple2enh_char';
        enhanced = true;
}

const options = {
    gl: prefs.readPref('gl_canvas', 'true') === 'true',
    canvas: document.querySelector<HTMLCanvasElement>('#screen')!,
    rom,
    characterRom,
    e: true,
    enhanced,
    tick: updateUI
};

export const apple2 = new Apple2(options);
apple2.ready.then(() => {
    const io = apple2.getIO();
    const cpu = apple2.getCPU();

    const printer = new Printer('#printer-modal .paper');
    const mouseUI = new MouseUI('#screen');

    const parallel = new Parallel(printer);
    const slinky = new RAMFactor(1024 * 1024);
    const disk2 = new DiskII(io, driveLights);
    const clock = new Thunderclock();
    const smartport = new SmartPort(cpu, { block: !enhanced });
    const mouse = new Mouse(cpu, mouseUI);

    io.setSlot(1, parallel);
    io.setSlot(2, slinky);
    io.setSlot(4, mouse);
    io.setSlot(5, clock);
    io.setSlot(6, disk2);
    io.setSlot(7, smartport);

    initUI(apple2, disk2, smartport, printer, options.e);
}).catch(console.error);
