import MicroModal from 'micromodal';

import Apple2IO from './apple2io';
import { HiresPage, LoresPage, VideoModes } from './canvas';
import CPU6502 from './cpu6502';
import MMU from './mmu';
import Prefs from './prefs';
import { debug, gup, hup } from './util';

import Audio from './ui/audio';
import { driveLights, initUI, loadAjax, doLoadHTTP } from './ui/apple2';
import { gamepad, configGamepad, initGamepad, processGamepad } from './ui/gamepad';
import KeyBoard from './ui/keyboard';
import Printer from './ui/printer';

import DiskII from './cards/disk2';
import Parallel from './cards/parallel';
import RAMFactor from './cards/ramfactor';
import Thunderclock from './cards/thunderclock';

import apple2e_charset from './roms/apple2e_char';
import apple2enh_charset from './roms/apple2enh_char';
import rmfont_charset from './roms/rmfont_char';

import Apple2eROM from './roms/apple2e';
import Apple2eEnhancedROM from './roms/apple2enh';

import SYMBOLS from './symbols';

export {
    compileAppleSoftProgram, dumpAppleSoftProgram,
    handleDrop, handleDragOver, handleDragEnd,
    openLoad, openSave,
    selectCategory, selectDisk, clickDisk, doLoad
} from './ui/apple2';

var kHz = 1023;

var focused = false;
var startTime = Date.now();
var lastCycles = 0;
var renderedFrames = 0, lastFrames = 0;
var paused = false;

var hashtag;

var DEBUG = true;
var TRACE = false;
var MAX_TRACE = 256;
var trace = [];

var disk2;

export function setTrace(debug, trace) {
    DEBUG = debug;
    TRACE = trace;
}

export function getTrace() {
    return trace;
}

var prefs = new Prefs();
var romVersion = prefs.readPref('computer_type2e');
var enhanced = false;
var multiScreen = false;
var rom;
var char_rom = apple2e_charset;
switch (romVersion) {
case 'apple2e':
    rom = new Apple2eROM();
    break;
case 'apple2rm':
    rom = new Apple2eEnhancedROM();
    char_rom = rmfont_charset;
    enhanced = true;
    break;
default:
    rom = new Apple2eEnhancedROM();
    char_rom =apple2enh_charset;
    enhanced = true;
}

var runTimer = null;
export var cpu = new CPU6502({'65C02': enhanced});

var context1, context2, context3, context4;

var canvas1 = document.getElementById('screen');
var canvas2 = document.getElementById('screen2');
var canvas3 = document.getElementById('screen3');
var canvas4 = document.getElementById('screen4');

context1 = canvas1.getContext('2d');
if (canvas4) {
    multiScreen = true;
    context2 = canvas2.getContext('2d');
    context3 = canvas3.getContext('2d');
    context4 = canvas4.getContext('2d');
} else if (canvas2) {
    multiScreen = true;
    context2 = context1;
    context3 = canvas2.getContext('2d');
    context4 = context3;
} else {
    context2 = context1;
    context3 = context1;
    context4 = context1;
}

var gr = new LoresPage(1, char_rom, true, context1);
var gr2 = new LoresPage(2, char_rom, true, context2);
var hgr = new HiresPage(1, context3);
var hgr2 = new HiresPage(2, context4);

var vm = new VideoModes(gr, hgr, gr2, hgr2, true);
vm.enhanced(enhanced);
vm.multiScreen(multiScreen);

var io = new Apple2IO(cpu, vm);
var keyboard = new KeyBoard(cpu, io, true);
var audio = new Audio(io);
var printer = new Printer('#printer-modal .paper');

var mmu = new MMU(cpu, vm, gr, gr2, hgr, hgr2, io, rom);

cpu.addPageHandler(mmu);

var parallel = new Parallel(io, 1, printer);
var slinky = new RAMFactor(io, 2, 1024 * 1024);
disk2 = new DiskII(io, 6, driveLights);
var clock = new Thunderclock(io, 7);

initUI(cpu, io, disk2);

io.setSlot(1, parallel);
io.setSlot(2, slinky);
io.setSlot(6, disk2);
io.setSlot(7, clock);

var showFPS = false;

function updateKHz() {
    var now = Date.now();
    var ms = now - startTime;
    var cycles = cpu.cycles();
    var delta;

    if (showFPS) {
        delta = renderedFrames - lastFrames;
        var fps = parseInt(delta/(ms/1000), 10);
        document.querySelector('#khz').innerText = fps + 'fps';
    } else {
        delta = cycles - lastCycles;
        var khz = parseInt(delta/ms);
        document.querySelector('#khz').innerText = khz + 'KHz';
    }

    startTime = now;
    lastCycles = cycles;
    lastFrames = renderedFrames;
}

export function toggleShowFPS() {
    showFPS = !showFPS;
}

export function updateSound() {
    var on = document.querySelector('#enable_sound').checked;
    var label = document.querySelector('#toggle-sound i');
    audio.enable(on);
    if (on) {
        label.classList.remove('fa-volume-off');
        label.classList.add('fa-volume-up');
    } else {
        label.classList.remove('fa-volume-up');
        label.classList.add('fa-volume-off');
    }
}

export function step()
{
    if (runTimer) {
        clearInterval(runTimer);
    }
    runTimer = null;

    cpu.step(function() {
        debug(cpu.dumpRegisters());
        debug(cpu.dumpPC());
    });
}

var accelerated = false;

export function updateCPU()
{
    accelerated = document.querySelector('#accelerator_toggle').checked;
    kHz = accelerated ? 4092 : 1023;
    io.updateHz(kHz * 1000);
    if (runTimer) {
        run();
    }
}

var _requestAnimationFrame =
    window.requestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.msRequestAnimationFrame;

function run(pc) {
    if (runTimer) {
        clearInterval(runTimer);
    }

    if (pc) {
        cpu.setPC(pc);
    }

    var ival = 30;

    var now, last = Date.now();
    var runFn = function() {
        now = Date.now();

        var step = (now - last) * kHz, stepMax = kHz * ival;
        last = now;
        if (step > stepMax) {
            step = stepMax;
        }

        if (document.location.hash != hashtag) {
            hashtag = document.location.hash;
            var hash = hup();
            if (hash) {
                processHash(hash);
            }
        }
        mmu.resetVB();
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
        if (vm.blit()) {
            renderedFrames++;
        }
        io.tick();

        processGamepad(io);

        if (!paused && _requestAnimationFrame) {
            _requestAnimationFrame(runFn);
        }
    };
    if (_requestAnimationFrame) {
        _requestAnimationFrame(runFn);
    } else {
        runTimer = setInterval(runFn, ival);
    }
}

function stop() {
    if (runTimer) {
        clearInterval(runTimer);
    }
    runTimer = null;
}

export function reset()
{
    cpu.reset();
}

var state = null;

function storeStateLocal() {
    window.localStorage['apple2.state'] = JSON.stringify(state);
}

function restoreStateLocal() {
    var data = window.localStorage['apple2.state'];
    if (data) {
        state = JSON.parse(data);
    }
}

function saveState() {
    if (state && !window.confirm('Overwrite Saved State?')) {
        return;
    }

    state = {
        cpu: cpu.getState(),
        io: io.getState(),
        mmu: mmu.getState(),
        vm: vm.getState(),
        disk2: disk2.getState(),
        driveLights: driveLights.getState()
    };
    if (slinky) {
        state.slinky = slinky.getState();
    }

    if (window.localStorage) {
        storeStateLocal();
    }
}

function restoreState() {
    if (window.localStorage) {
        restoreStateLocal();
    }
    if (!state) {
        return;
    }
    cpu.setState(state.cpu);
    io.setState(state.io);
    mmu.setState(state.mmu);
    vm.setState(state.vm);
    disk2.setState(state.disk2);
    driveLights.setState(state.driveLights);
    if (slinky && state.slinky) {
        slinky.setState(state.slinky);
    }
}

function processHash(hash) {
    var files = hash.split('|');
    for (var idx = 0; idx < files.length; idx++) {
        var file = files[idx];
        if (file.indexOf('://') > 0) {
            var parts = file.split('.');
            var ext = parts[parts.length - 1].toLowerCase();
            if (ext == 'json') {
                loadAjax(idx + 1, file);
            } else {
                doLoadHTTP(idx + 1, file);
            }
        } else {
            loadAjax(idx + 1, 'json/disks/' + file + '.json');
        }
    }
}

/*
 * Keyboard/Gamepad routines
 */

function _keydown(evt) {
    if (!focused && (!evt.metaKey || evt.ctrlKey)) {
        evt.preventDefault();

        var key = keyboard.mapKeyEvent(evt);
        if (key != 0xff) {
            io.keyDown(key);
        }
    }
    if (evt.keyCode === 112) { // F1 - Reset
        cpu.reset();
        evt.preventDefault(); // prevent launching help
    } else if (evt.keyCode === 113) { // F2 - Full Screen
        var elem = document.getElementById('screen');
        if (evt.shiftKey) { // Full window, but not full screen
            document.querySelector('#display').classList.toggle('zoomwindow');
            document.querySelector('#display > div').classList.toggle('overscan');
            document.querySelector('#display > div').classList.toggle('flexbox-centering');
            document.querySelector('#screen').classList.toggle('maxhw');
            document.querySelector('#header').classList.toggle('hidden');
            document.querySelectorAll('.inset').forEach(function(el) { el.classList.toggle('hidden'); });
            document.querySelector('#reset').classList.toggle('hidden');
        } else if (document.webkitCancelFullScreen) {
            if (document.webkitIsFullScreen) {
                document.webkitCancelFullScreen();
            } else {
                if (Element.ALLOW_KEYBOARD_INPUT) {
                    elem.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
                } else {
                    elem.webkitRequestFullScreen();
                }
            }
        } else if (document.mozCancelFullScreen) {
            if (document.mozIsFullScreen) {
                document.mozCancelFullScreen();
            } else {
                elem.mozRequestFullScreen();
            }
        }
    } else if (evt.keyCode === 114) { // F3
        io.keyDown(0x1b);
    } else if (evt.keyCode === 117) { // F6 Quick Save
        saveState();
    } else if (evt.keyCode === 120) { // F9 Quick Restore
        restoreState();
    } else if (evt.keyCode == 16) { // Shift
        keyboard.shiftKey(true);
    } else if (evt.keyCode == 17) { // Control
        keyboard.controlKey(true);
    } else if (evt.keyCode == 91 || evt.keyCode == 93) { // Command
        keyboard.commandKey(true);
    } else if (evt.keyCode == 18) { // Alt
        if (evt.location == 1) {
            keyboard.commandKey(true);
        } else {
            keyboard.optionKey(true);
        }
    }
}

function _keyup(evt) {
    if (!focused)
        io.keyUp();

    if (evt.keyCode == 16) { // Shift
        keyboard.shiftKey(false);
    } else if (evt.keyCode == 17) { // Control
        keyboard.controlKey(false);
    } else if (evt.keyCode == 91 || evt.keyCode == 93) { // Command
        keyboard.commandKey(false);
    } else if (evt.keyCode == 18) { // Alt
        if (evt.location == 1) {
            keyboard.commandKey(false);
        } else {
            keyboard.optionKey(false);
        }
    }
}

export function updateScreen() {
    var green = document.querySelector('#green_screen').checked;
    var scanlines = document.querySelector('#show_scanlines').checked;

    vm.green(green);
    vm.scanlines(scanlines);
}

var disableMouseJoystick = false;
var flipX = false;
var flipY = false;
var swapXY = false;

export function updateJoystick() {
    disableMouseJoystick = document.querySelector('#disable_mouse').checked;
    flipX = document.querySelector('#flip_x').checked;
    flipY = document.querySelector('#flip_y').checked;
    swapXY = document.querySelector('#swap_x_y').checked;
    configGamepad(flipX, flipY);

    if (disableMouseJoystick) {
        io.paddle(0, 0.5);
        io.paddle(1, 0.5);
        return;
    }
}

function _mousemove(evt) {
    if (gamepad || disableMouseJoystick) {
        return;
    }

    var s = document.querySelector('#screen');
    var offset = s.getBoundingClientRect();
    var x = (evt.pageX - offset.left) / s.clientWidth,
        y = (evt.pageY - offset.top) / s.clientHeight,
        z = x;

    if (swapXY) {
        x = y;
        y = z;
    }

    io.paddle(0, flipX ? 1 - x : x);
    io.paddle(1, flipY ? 1 - y : y);
}

export function pauseRun() {
    var label = document.querySelector('#pause-run i');
    if (paused) {
        run();
        label.classList.remove('fa-play');
        label.classList.add('fa-pause');
    } else {
        stop();
        label.classList.remove('fa-pause');
        label.classList.add('fa-play');
    }
    paused = !paused;
}

export function toggleSound() {
    var enableSound = document.querySelector('#enable_sound');
    enableSound.checked = !enableSound.checked;
    updateSound();
}

export function openOptions() {
    MicroModal.show('options-modal');
}

export function openPrinterModal() {
    MicroModal.show('printer-modal');
}

MicroModal.init();

document.addEventListener('DOMContentLoaded', function() {
    hashtag = document.location.hash;

    /*
     * Input Handling
     */

    window.addEventListener('keydown', _keydown);
    window.addEventListener('keyup', _keyup);
    window.addEventListener('mousedown', function() { audio.autoStart(); });

    document.querySelectorAll('canvas').forEach(function(canvas) {
        canvas.addEventListener('mousedown', function(evt) {
            if (!gamepad) {
                io.buttonDown(evt.which == 1 ? 0 : 1);
            }
            evt.preventDefault();
        });
        canvas.addEventListener('mouseup', function(evt) {
            if (!gamepad) {
                io.buttonUp(evt.which == 1 ? 0 : 1);
            }
        });
    });

    document.body.addEventListener('mousemove', _mousemove);

    document.querySelectorAll('input,textarea').forEach(function(input) {
        input.addEventListener('input', function() { focused = true; });
        input.addEventListener('blur', function() { focused = false; });
    });

    keyboard.create('#keyboard');

    if (prefs.havePrefs()) {
        document.querySelectorAll('#options-modal input[type=checkbox]').forEach(function(el) {
            var val = prefs.readPref(el.id);
            if (val) {
                el.checked = JSON.parse(val);
            }
            el.addEventListener('change', function() {
                prefs.writePref(el.id, JSON.stringify(el.checked));
            });
        });
        document.querySelectorAll('#options-modal select').forEach(function(el) {
            var val = prefs.readPref(el.id);
            if (val) {
                el.value = val;
            }
            el.addEventListener('change', function() {
                prefs.writePref(el.id, el.value);
            });
        });
    }

    cpu.reset();
    setInterval(updateKHz, 1000);
    updateSound();
    updateScreen();
    updateCPU();
    initGamepad();

    // Check for disks in hashtag

    var hash = gup('disk') || hup();
    if (hash) {
        processHash(hash);
    }

    if (navigator.standalone) {
        document.body.classList.add('standalone');
    }

    run();
});
