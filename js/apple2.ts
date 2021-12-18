import Apple2IO from './apple2io';
import {
    HiresPage,
    LoresPage,
    VideoModes,
    VideoModesState,
} from './videomodes';
import {
    HiresPage2D,
    LoresPage2D,
    VideoModes2D,
} from './canvas';
import {
    HiresPageGL,
    LoresPageGL,
    VideoModesGL,
} from './gl';
import ROM from './roms/rom';
import { Apple2IOState } from './apple2io';
import CPU6502, {
    CpuState,
    FLAVOR_6502,
    FLAVOR_ROCKWELL_65C02,
} from './cpu6502';
import MMU, { MMUState } from './mmu';
import RAM, { RAMState } from './ram';

import SYMBOLS from './symbols';
import Debugger, { DebuggerContainer } from './debugger';

import { Restorable, rom } from './types';
import { processGamepad } from './ui/gamepad';

export interface Apple2Options {
    characterRom: string;
    enhanced: boolean,
    e: boolean,
    gl: boolean,
    rom: string,
    canvas: HTMLCanvasElement,
    tick: () => void,
}

export interface Stats {
    frames: number,
    renderedFrames: number,
}

interface State {
    cpu: CpuState,
    vm: VideoModesState,
    io: Apple2IOState,
    mmu?: MMUState,
    ram?: RAMState[],
}

export class Apple2 implements Restorable<State>, DebuggerContainer {
    private paused = false;

    private theDebugger?: Debugger;

    private runTimer: number | null = null;
    private runAnimationFrame: number | null = null;
    private cpu: CPU6502;

    private gr: LoresPage;
    private gr2: LoresPage;
    private hgr: HiresPage;
    private hgr2: HiresPage;
    private vm: VideoModes;

    private io: Apple2IO;
    private mmu: MMU | undefined;
    private ram: [RAM, RAM, RAM] | undefined;
    private characterRom: rom;
    private rom: ROM;

    private tick: () => void;

    private stats: Stats = {
        frames: 0,
        renderedFrames: 0
    };

    public ready: Promise<void>;

    constructor(options: Apple2Options) {
        this.ready = this.init(options);
    }

    async init(options: Apple2Options) {
        const romImportPromise = import(`./roms/system/${options.rom}`);
        const characterRomImportPromise = import(`./roms/character/${options.characterRom}`);

        const LoresPage = options.gl ? LoresPageGL : LoresPage2D;
        const HiresPage = options.gl ? HiresPageGL : HiresPage2D;
        const VideoModes = options.gl ? VideoModesGL : VideoModes2D;

        this.cpu = new CPU6502({
            flavor: options.enhanced ? FLAVOR_ROCKWELL_65C02 : FLAVOR_6502
        });
        this.vm = new VideoModes(options.canvas, options.e);

        const [{ default: Apple2ROM }, { default: characterRom }] = await Promise.all([
            romImportPromise,
            characterRomImportPromise,
            this.vm.ready,
        ]);

        this.rom = new Apple2ROM();
        this.characterRom = characterRom;

        this.gr = new LoresPage(this.vm, 1, this.characterRom, options.e);
        this.gr2 = new LoresPage(this.vm, 2, this.characterRom, options.e);
        this.hgr = new HiresPage(this.vm, 1);
        this.hgr2 = new HiresPage(this.vm, 2);
        this.io = new Apple2IO(this.cpu, this.vm);
        this.tick = options.tick;

        if (options.e) {
            this.mmu = new MMU(this.cpu, this.vm, this.gr, this.gr2, this.hgr, this.hgr2, this.io, this.rom);
            this.cpu.addPageHandler(this.mmu);
        } else {
            this.ram = [
                new RAM(0x00, 0x03),
                new RAM(0x0C, 0x1F),
                new RAM(0x60, 0xBF)
            ];

            this.cpu.addPageHandler(this.ram[0]);
            this.cpu.addPageHandler(this.gr);
            this.cpu.addPageHandler(this.gr2);
            this.cpu.addPageHandler(this.ram[1]);
            this.cpu.addPageHandler(this.hgr);
            this.cpu.addPageHandler(this.hgr2);
            this.cpu.addPageHandler(this.ram[2]);
            this.cpu.addPageHandler(this.io);
            this.cpu.addPageHandler(this.rom);
        }
    }

    /**
     * Runs the emulator. If the emulator is already running, this does
     * nothing. When this function exits either `runTimer` or
     * `runAnimationFrame` will be non-null.
     */
    run() {
        this.paused = false;
        if (this.runTimer || this.runAnimationFrame) {
            return; // already running
        }

        this.theDebugger = new Debugger(this);
        this.theDebugger.addSymbols(SYMBOLS);

        const interval = 30;

        let now, last = Date.now();
        const runFn = () => {
            const kHz = this.io.getKHz();
            now = Date.now();

            const stepMax = kHz * interval;
            let step = (now - last) * kHz;
            last = now;
            if (step > stepMax) {
                step = stepMax;
            }

            if (this.theDebugger) {
                this.theDebugger.stepCycles(step);
            } else {
                this.cpu.stepCycles(step);
            }
            if (this.mmu) {
                this.mmu.resetVB();
            }
            if (this.io.annunciator(0)) {
                const imageData = this.io.blit();
                if (imageData) {
                    this.vm.blit(imageData);
                    this.stats.renderedFrames++;
                }
            } else {
                if (this.vm.blit()) {
                    this.stats.renderedFrames++;
                }
            }
            this.stats.frames++;
            this.io.tick();
            this.tick();
            processGamepad(this.io);

            if (!this.paused && requestAnimationFrame) {
                this.runAnimationFrame = requestAnimationFrame(runFn);
            }
        };
        if (requestAnimationFrame) {
            this.runAnimationFrame = requestAnimationFrame(runFn);
        } else {
            this.runTimer = window.setInterval(runFn, interval);
        }
    }

    stop() {
        this.paused = true;
        if (this.runTimer) {
            clearInterval(this.runTimer);
        }
        if (this.runAnimationFrame) {
            cancelAnimationFrame(this.runAnimationFrame);
        }
        this.runTimer = null;
        this.runAnimationFrame = null;
    }

    getState(): State {
        const state: State = {
            cpu: this.cpu.getState(),
            vm: this.vm.getState(),
            io: this.io.getState(),
            mmu: this.mmu?.getState(),
            ram: this.ram?.map(bank => bank.getState()),
        };

        return state;
    }

    setState(state: State) {
        this.cpu.setState(state.cpu);
        this.vm.setState(state.vm);
        this.io.setState(state.io);
        if (this.mmu && state.mmu) {
            this.mmu.setState(state.mmu);
        }
        if (this.ram) {
            this.ram.forEach((bank, idx) => {
                if (state.ram) {
                    bank.setState(state.ram[idx]);
                }
            });
        }
    }

    reset() {
        this.cpu.reset();
    }

    getStats(): Stats {
        return this.stats;
    }

    getCPU() {
        return this.cpu;
    }

    getIO() {
        return this.io;
    }

    getMMU() {
        return this.mmu;
    }

    getROM() {
        return this.rom;
    }

    getVideoModes() {
        return this.vm;
    }

    getDebugger() {
        return this.theDebugger;
    }
}
