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
import { Apple2IOState } from './apple2io';
import CPU6502, { PageHandler, CpuState } from './cpu6502';
import MMU from './mmu';
import RAM from './ram';
import { debug } from './util';

import SYMBOLS from './symbols';
import { Restorable, memory } from './types';
import { processGamepad } from './ui/gamepad';

interface Options {
    characterRom: memory,
    enhanced: boolean,
    e: boolean,
    gl: boolean,
    rom: PageHandler,
    canvas: HTMLCanvasElement,
    tick: () => void,
}

interface State {
    cpu: CpuState,
    vm: VideoModesState,
    io: Apple2IOState,
}

export class Apple2 implements Restorable<State> {
    private paused = false;

    private DEBUG = false;
    private TRACE = false;
    private MAX_TRACE = 256;
    private trace: string[] = [];

    private runTimer: number | null = null;
    private runAnimationFrame: number | null = null;
    private cpu: CPU6502;

    private gr: LoresPage;
    private gr2: LoresPage;
    private hgr: HiresPage;
    private hgr2: HiresPage;
    private vm: VideoModes;

    private io: Apple2IO;
    private mmu: MMU;

    private tick: () => void;

    private stats = {
        frames: 0,
        renderedFrames: 0
    };

    constructor(options: Options) {
        const LoresPage = options.gl ? LoresPageGL : LoresPage2D;
        const HiresPage = options.gl ? HiresPageGL : HiresPage2D;
        const VideoModes = options.gl ? VideoModesGL : VideoModes2D;

        this.cpu = new CPU6502({ '65C02': options.enhanced });
        this.gr = new LoresPage(1, options.characterRom, options.e);
        this.gr2 = new LoresPage(2, options.characterRom, options.e);
        this.hgr = new HiresPage(1);
        this.hgr2 = new HiresPage(2);
        this.vm = new VideoModes(this.gr, this.hgr, this.gr2, this.hgr2, options.canvas, options.e);
        this.vm.enhanced(options.enhanced);
        this.io = new Apple2IO(this.cpu, this.vm);
        this.tick = options.tick;

        if (options.e) {
            this.mmu = new MMU(this.cpu, this.vm, this.gr, this.gr2, this.hgr, this.hgr2, this.io, options.rom);
            this.cpu.addPageHandler(this.mmu);
        } else {
            const ram1 = new RAM(0x00, 0x03);
            const ram2 = new RAM(0x0C, 0x1F);
            const ram3 = new RAM(0x60, 0xBF);

            this.cpu.addPageHandler(ram1);
            this.cpu.addPageHandler(this.gr);
            this.cpu.addPageHandler(this.gr2);
            this.cpu.addPageHandler(ram2);
            this.cpu.addPageHandler(this.hgr);
            this.cpu.addPageHandler(this.hgr2);
            this.cpu.addPageHandler(ram3);
            this.cpu.addPageHandler(this.io);
            this.cpu.addPageHandler(options.rom);
        }
    }

    /**
     * Runs the emulator. If the emulator is already running, this does
     * nothing. When this function exits either `runTimer` or
     * `runAnimationFrame` will be non-null.
     */
    run() {
        if (this.runTimer || this.runAnimationFrame) {
            return; // already running
        }

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

            if (this.DEBUG) {
                this.cpu.stepCyclesDebug(this.TRACE ? 1 : step, () => {
                    const line = this.cpu.dumpRegisters() + ' ' +
                        this.cpu.dumpPC(undefined, SYMBOLS);
                    if (this.TRACE) {
                        debug(line);
                    } else {
                        this.trace.push(line);
                        if (this.trace.length > this.MAX_TRACE) {
                            this.trace.shift();
                        }
                    }
                });
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
        };

        return state;
    }

    setState(state: State) {
        this.cpu.setState(state.cpu);
        this.vm.setState(state.vm);
        this.io.setState(state.io);
    }

    reset() {
        this.cpu.reset();
    }

    getStats() {
        return this.stats;
    }

    getCPU() {
        return this.cpu;
    }

    getIO() {
        return this.io;
    }

    getVideoModes() {
        return this.vm;
    }
}
