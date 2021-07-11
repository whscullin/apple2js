import MicroModal from 'micromodal';

import { base64_json_parse, base64_json_stringify } from '../base64';
import { Audio, SOUND_ENABLED_OPTION } from './audio';
import DriveLights from './drive_lights';
import { includes } from '../types';
import { BLOCK_FORMATS, NIBBLE_FORMATS, BlockStorage } from '../formats/types';
import {
    DRIVE_NUMBERS,
} from '../formats/types';
import { initGamepad } from './gamepad';
import KeyBoard from './keyboard';
import Tape from './tape';
import { gup, hup } from './url';

import ApplesoftDump from '../applesoft/decompiler';
import ApplesoftCompiler from '../applesoft/compiler';

import { debug } from '../util';
import { Apple2, Stats } from '../apple2';
import DiskII from '../cards/disk2';
import CPU6502 from '../cpu6502';
import { VideoModes } from '../videomodes';
import Apple2IO from '../apple2io';
import Printer from './printer';

import { OptionsModal } from './options_modal';
import { Screen, SCREEN_FULL_PAGE } from './screen';
import { JoyStick } from './joystick';
import { System } from './system';

import { Disk2UI } from './disk2';
import { BlockStorageUI } from './block_storage';

let paused = false;

let startTime = Date.now();
let lastCycles = 0;
let lastFrames = 0;
let lastRenderedFrames = 0;

let hashtag = document.location.hash;

const optionsModal = new OptionsModal();

let _apple2: Apple2;
let cpu: CPU6502;
let stats: Stats;
let vm: VideoModes;
let tape: Tape;
let audio: Audio;
let screen: Screen;
let joystick: JoyStick;
let system: System;
let keyboard: KeyBoard;
let io: Apple2IO;

let ready: Promise<[void, void]>;

export const diskLights = new DriveLights('disk');
export const BlockStorageLights = new DriveLights('mass-storage');

export function dumpAppleSoftProgram() {
    const dumper = new ApplesoftDump(cpu);
    debug(dumper.toString());
}

export function compileAppleSoftProgram(program: string) {
    const compiler = new ApplesoftCompiler(cpu);
    compiler.compile(program);
    dumpAppleSoftProgram();
}

let showStats = 0;

function updateKHz() {
    const now = Date.now();
    const ms = now - startTime;
    const cycles = cpu.getCycles();
    let delta;
    let fps;
    let khz;

    const kHzElement = document.querySelector<HTMLDivElement>('#khz')!;
    switch (showStats) {
        case 0: {
            delta = cycles - lastCycles;
            khz = Math.trunc(delta / ms);
            kHzElement.innerText = khz + ' kHz';
            break;
        }
        case 1: {
            delta = stats.renderedFrames - lastRenderedFrames;
            fps = Math.trunc(delta / (ms / 1000));
            kHzElement.innerText = fps + ' rps';
            break;
        }
        default: {
            delta = stats.frames - lastFrames;
            fps = Math.trunc(delta / (ms / 1000));
            kHzElement.innerText = fps + ' fps';
        }
    }

    startTime = now;
    lastCycles = cycles;
    lastRenderedFrames = stats.renderedFrames;
    lastFrames = stats.frames;
}

export function toggleShowFPS() {
    showStats = ++showStats % 3;
}

export function toggleSound() {
    const on = !audio.isEnabled();
    optionsModal.setOption(SOUND_ENABLED_OPTION, on);
    updateSoundButton(on);
}

function initSoundToggle() {
    updateSoundButton(audio.isEnabled());
}

function updateSoundButton(on: boolean) {
    const label = document.querySelector<HTMLDivElement>('#toggle-sound i')!;
    if (on) {
        label.classList.remove('fa-volume-off');
        label.classList.add('fa-volume-up');
    } else {
        label.classList.remove('fa-volume-up');
        label.classList.add('fa-volume-off');
    }
}

export function reset() {
    _apple2.reset();
}

/**
 * Processes the URL fragment. It is expected to be of the form:
 * `disk1|disk2` where each disk is the name of a local image OR
 * a URL.
 */
function processHash(hash: string) {
    const files = hash.split('|');
    for (let idx = 0; idx < Math.min(2, files.length); idx++) {
        const drive = idx + 1;
        if (!includes(DRIVE_NUMBERS, drive)) {
            break;
        }
        const file = files[idx];
        if (file.indexOf('://') > 0) {
            const parts = file.split('.');
            const ext = parts[parts.length - 1].toLowerCase();
            if (ext == 'json') {
                window.Disk2UI.loadAjax(drive, file);
            } else if (includes(NIBBLE_FORMATS, ext)) {
                window.Disk2UI.doLoadHTTP(drive, file);
            } else if (includes(BLOCK_FORMATS, ext)) {
                window.BlockStorageUI.doLoadHTTP(drive, file);
            }
        } else if (file) {
            window.Disk2UI.loadAjax(drive, 'json/disks/' + file + '.json');
        }
    }
}

export function updateUI() {
    if (document.location.hash != hashtag) {
        hashtag = document.location.hash;
        const hash = hup();
        if (hash) {
            processHash(hash);
        }
    }
}

export function pauseRun() {
    const label = document.querySelector<HTMLElement>('#pause-run i')!;
    if (paused) {
        ready.then(() => {
            _apple2.run();
        }).catch(console.error);
        label.classList.remove('fa-play');
        label.classList.add('fa-pause');
    } else {
        _apple2.stop();
        label.classList.remove('fa-pause');
        label.classList.add('fa-play');
    }
    paused = !paused;
}

declare global {
    interface Window {
        clipboardData?: DataTransfer;
    }
    interface Event {
        clipboardData?: DataTransfer;
    }
    interface Navigator {
        standalone?: boolean;
    }
}

declare global {
    interface Window {
        Disk2UI: Disk2UI
        OptionsModal: OptionsModal
        BlockStorageUI: BlockStorageUI
        Printer: Printer
    }
}

function onLoaded(apple2: Apple2, disk2: DiskII, BlockStorage: BlockStorage, printer: Printer, e: boolean) {
    _apple2 = apple2;
    cpu = _apple2.getCPU();
    io = _apple2.getIO();
    stats = apple2.getStats();
    vm = apple2.getVideoModes();
    tape = new Tape(io);

    system = new System(io, e);
    optionsModal.addOptions(system);

    joystick = new JoyStick(io);
    optionsModal.addOptions(joystick);

    screen = new Screen(vm);
    optionsModal.addOptions(screen);

    audio = new Audio(io);
    optionsModal.addOptions(audio);
    initSoundToggle();

    window.Disk2UI = new Disk2UI(cpu, disk2, tape, e);
    window.BlockStorageUI = new BlockStorageUI(BlockStorage);
    window.OptionsModal = optionsModal;
    window.Printer = printer;

    ready = Promise.all([
        audio.ready,
        apple2.ready
    ]);

    MicroModal.init();

    keyboard = new KeyBoard(cpu, io, e);
    keyboard.create('#keyboard');
    keyboard.setFunction('F1', () => cpu.reset());
    keyboard.setFunction('F2', (event) => {
        if (event.shiftKey) { // Full window, but not full screen
            optionsModal.setOption(
                SCREEN_FULL_PAGE,
                !optionsModal.getOption(SCREEN_FULL_PAGE)
            );
        } else {
            screen.enterFullScreen();
        }
    });
    keyboard.setFunction('F3', () => io.keyDown(0x1b)); // Escape
    keyboard.setFunction('F4', optionsModal.openModal);
    keyboard.setFunction('F6', () => {
        window.localStorage.state = base64_json_stringify(_apple2.getState());
    });
    keyboard.setFunction('F9', () => {
        if (window.localStorage.state) {
            _apple2.setState(base64_json_parse(window.localStorage.state));
        }
    });

    /*
     * Input Handling
     */

    window.addEventListener('paste', (event: Event) => {
        const paste = (event.clipboardData || window.clipboardData)!.getData('text');
        io.setKeyBuffer(paste);
        event.preventDefault();
    });

    window.addEventListener('copy', (event: Event) => {
        event.clipboardData!.setData('text/plain', vm.getText());
        event.preventDefault();
    });

    if (navigator.standalone) {
        document.body.classList.add('standalone');
    }

    cpu.reset();
    setInterval(updateKHz, 1000);
    initGamepad();

    // Check for disks in hashtag

    const hash = gup('disk') || hup();
    if (hash) {
        processHash(hash);
    }
    ready.then(() => {
        _apple2.run();
    }).catch(console.error);
}

export function initUI(apple2: Apple2, disk2: DiskII, BlockStorage: BlockStorage, printer: Printer, e: boolean) {
    window.addEventListener('load', () => {
        onLoaded(apple2, disk2, BlockStorage, printer, e);
    });
}
