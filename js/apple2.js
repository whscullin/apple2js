import Apple2IO from './apple2io';
import { HiresPage, LoresPage, VideoModes } from './canvas';
import CPU6502 from './cpu6502';
import MMU from './mmu';
import RAM from './ram';
import { debug } from './util';

import SYMBOLS from './symbols';

export function Apple2(options) {
    var stats = {
        frames: 0,
        renderedFrames: 0
    };

    var paused = false;

    var DEBUG = false;
    var TRACE = false;
    var MAX_TRACE = 256;
    var trace = [];

    var runTimer = null;
    var runAnimationFrame = null;
    var cpu = new CPU6502({ '65C02': options.enhanced });

    var gr = new LoresPage(1, options.characterRom, options.e, options.screen[0]);
    var gr2 = new LoresPage(2, options.characterRom, options.e, options.screen[1]);
    var hgr = new HiresPage(1, options.screen[2]);
    var hgr2 = new HiresPage(2, options.screen[3]);

    var vm = new VideoModes(gr, hgr, gr2, hgr2, options.e);
    vm.multiScreen(options.multiScreen);
    vm.enhanced(options.enhanced);

    var io = new Apple2IO(cpu, vm);
    var mmu = null;

    if (options.e) {
        mmu = new MMU(cpu, vm, gr, gr2, hgr, hgr2, io, options.rom);
        cpu.addPageHandler(mmu);
    } else {
        var ram1 = new RAM(0x00, 0x03),
            ram2 = new RAM(0x0C, 0x1F),
            ram3 = new RAM(0x60, 0xBF);

        cpu.addPageHandler(ram1);
        cpu.addPageHandler(gr);
        cpu.addPageHandler(gr2);
        cpu.addPageHandler(ram2);
        cpu.addPageHandler(hgr);
        cpu.addPageHandler(hgr2);
        cpu.addPageHandler(ram3);
        cpu.addPageHandler(io);
        cpu.addPageHandler(options.rom);
    }

    var _requestAnimationFrame =
        window.requestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.msRequestAnimationFrame;

    var _cancelAnimationFrame =
        window.cancelAnimationFrame ||
        window.mozCancelAnimationFrame ||
        window.webkitCancelAnimationFrame ||
        window.msCancelAnimationFrame;

    /**
     * Runs the emulator. If the emulator is already running, this does
     * nothing. When this function exits either `runTimer` or
     * `runAnimationFrame` will be non-null.
     */
    function run() {
        if (runTimer || runAnimationFrame) {
            return; // already running
        }

        var interval = 30;

        var now, last = Date.now();
        var runFn = function() {
            var kHz = io.getKHz();
            now = Date.now();

            var step = (now - last) * kHz, stepMax = kHz * interval;
            last = now;
            if (step > stepMax) {
                step = stepMax;
            }

            if (DEBUG) {
                cpu.stepCyclesDebug(TRACE ? 1 : step, function() {
                    var line = cpu.dumpRegisters() + ' ' +
                        cpu.dumpPC(undefined, SYMBOLS);
                    if (TRACE) {
                        debug(line);
                    } else {
                        trace.push(line);
                        if (trace.length > MAX_TRACE) {
                            trace.shift();
                        }
                    }
                });
            } else {
                cpu.stepCycles(step);
            }
            if (mmu) {
                mmu.resetVB();
            }
            if (io.annunciator(0)) {
                if (options.multiScreen) {
                    vm.blit();
                }
                if (io.blit()) {
                    stats.renderedFrames++;
                }
            } else {
                if (vm.blit()) {
                    stats.renderedFrames++;
                }
            }
            stats.frames++;
            io.tick();
            options.tick();

            if (!paused && _requestAnimationFrame) {
                runAnimationFrame = _requestAnimationFrame(runFn);
            }
        };
        if (_requestAnimationFrame) {
            runAnimationFrame = _requestAnimationFrame(runFn);
        } else {
            runTimer = setInterval(runFn, interval);
        }
    }

    function stop() {
        if (runTimer) {
            clearInterval(runTimer);
        }
        if (runAnimationFrame) {
            _cancelAnimationFrame(runAnimationFrame);
        }
        runTimer = null;
        runAnimationFrame = null;
    }

    function saveState() {
        var state = {
            cpu: cpu.getState(),
        };

        return state;
    }

    function restoreState(state) {
        cpu.setState(state.cpu);
    }

    return {
        reset: function () {
            cpu.reset();
        },

        run: function () {
            run();
        },

        stop: function () {
            stop();
        },

        saveState: function () {
            saveState();
        },

        restoreState: function () {
            restoreState();
        },

        getStats: function () {
            return stats;
        },

        getCPU: function () {
            return cpu;
        },

        getIO: function () {
            return io;
        },

        getVideoModes: function () {
            return vm;
        }
    };
}
