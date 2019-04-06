import MicroModal from 'micromodal';

import Apple2IO from './apple2io';
import ApplesoftDump from './applesoft/decompiler';
import { HiresPage, LoresPage, VideoModes } from './canvas';
import CPU6502 from './cpu6502';
import Prefs from './prefs';
import RAM from './ram';
import { debug, gup, hup } from './util';

import Audio from './ui/audio';
import DriveLights from './ui/drive_lights';
import { gamepad, configGamepad, initGamepad, processGamepad } from './ui/gamepad';
import KeyBoard from './ui/keyboard';
import Printer from './ui/printer';
import Tape, { TAPE_TYPES } from './ui/tape';

import DiskII, { DISK_TYPES } from './cards/disk2';
import LanguageCard from './cards/langcard';
import Parallel from './cards/parallel';
import RAMFactor from './cards/ramfactor';
import Thunderclock from './cards/thunderclock';
import Videoterm from './cards/videoterm';

import apple2_charset from './roms/apple2_char';
import apple2j_charset from './roms/apple2j_char';
import apple2lc_charset from './roms/apple2lc_char';
import pigfont_charset from './roms/pigfont_char';

import Apple2ROM from './roms/fpbasic';
import Apple2jROM from './roms/apple2j_char';
import IntBASIC from './roms/intbasic';
import OriginalROM from './roms/original';

import SYMBOLS from './symbols';

var kHz = 1023;

var focused = false;
var startTime = Date.now();
var lastCycles = 0;
var renderedFrames = 0, lastFrames = 0;
var paused = false;

var hashtag;

var DEBUG = false;
var TRACE = false;
var MAX_TRACE = 256;
var trace = [];

var disk_categories = {'Local Saves': []};
var disk_sets = {};
var disk_cur_name = [];
var disk_cur_cat = [];

var _currentDrive = 1;

export function openLoad(drive, event)
{
    _currentDrive = parseInt(drive, 10);
    if (event.metaKey) {
        openLoadHTTP(drive);
    } else {
        if (disk_cur_cat[drive]) {
            document.querySelector('#category_select').value = disk_cur_cat[drive];
            selectCategory();
        }
        MicroModal.show('load-modal');
    }
}

export function openSave(drive, event)
{
    _currentDrive = parseInt(drive, 10);

    var mimetype = 'application/octet-stream';
    var data = disk2.getBinary(drive);
    var a = document.querySelector('#local_save_link');

    var blob = new Blob([data], { 'type': mimetype });
    a.href = window.URL.createObjectURL(blob);
    a.download = drivelights.label(drive) + '.dsk';

    if (event.metaKey) {
        dumpDisk(drive);
    } else {
        document.querySelector('#save_name').value = drivelights.label(drive);
        MicroModal.show('save-modal');
    }
}

export function handleDragOver(drive, event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
}

export function handleDragEnd(drive, event) {
    var dt = event.dataTransfer;
    if (dt.items) {
        for (var i = 0; i < dt.items.length; i++) {
            dt.items.remove(i);
        }
    } else {
        event.dataTransfer.clearData();
    }
}

export function handleDrop(drive, event) {
    event.preventDefault();
    event.stopPropagation();

    if (drive < 1) {
        if (!disk2.getMetadata(1)) {
            drive = 1;
        } else if (!disk2.getMetadata(2)) {
            drive = 2;
        } else {
            drive = 1;
        }
    }
    var dt = event.dataTransfer;
    if (dt.files.length == 1) {
        doLoadLocal(drive, dt.files[0]);
    } else if (dt.files.length == 2) {
        doLoadLocal(1, dt.files[0]);
        doLoadLocal(2, dt.files[1]);
    } else {
        for (var idx = 0; idx < dt.items.length; idx++) {
            if (dt.items[idx].type === 'text/uri-list') {
                dt.items[idx].getAsString(function(url) {
                    var parts = document.location.hash.split('|');
                    parts[drive - 1] = url;
                    document.location.hash = parts.join('|');
                });
            }
        }
    }
}

var loading = false;

function loadAjax(drive, url) {
    loading = true;
    MicroModal.show('loading-modal');

    fetch(url).then(function(response) {
        return response.json();
    }).then(function(data) {
        if (data.type == 'binary') {
            loadBinary(drive, data);
        } else if (DISK_TYPES.includes(data.type)) {
            loadDisk(drive, data);
        }
        initGamepad(data.gamepad);
        MicroModal.close('loading-modal');
        loading = false;
    }).catch(function(error) {
        window.alert(error || status);
        MicroModal.close('loading-modal');
        loading = false;
    });
}

export function doLoad() {
    MicroModal.close('load-modal');
    var urls = document.querySelector('#disk_select').value, url;
    if (urls && urls.length) {
        if (typeof(urls) == 'string') {
            url = urls;
        } else {
            url = urls[0];
        }
    }

    var files = document.querySelector('#local_file').files;
    if (files.length == 1) {
        doLoadLocal(_currentDrive, files[0]);
    } else if (url) {
        var filename;
        if (url.substr(0,6) == 'local:') {
            filename = url.substr(6);
            if (filename == '__manage') {
                openManage();
            } else {
                loadLocalStorage(_currentDrive, filename);
            }
        } else {
            var r1 = /json\/disks\/(.*).json$/.exec(url);
            if (r1) {
                filename = r1[1];
            } else {
                filename = url;
            }
            var parts = document.location.hash.split('|');
            parts[_currentDrive - 1] = filename;
            document.location.hash = parts.join('|');
        }
    }
}

export function doSave() {
    var name = document.querySelector('#save_name').value;
    saveLocalStorage(_currentDrive, name);
    MicroModal.close('save-modal');
}

export function doDelete(name) {
    if (window.confirm('Delete ' + name + '?')) {
        deleteLocalStorage(name);
    }
}

function doLoadLocal(drive, file) {
    var parts = file.name.split('.');
    var ext = parts[parts.length - 1].toLowerCase();
    if (DISK_TYPES.includes(ext)) {
        doLoadLocalDisk(drive, file);
    } else if (TAPE_TYPES.includes(ext)) {
        tape.doLoadLocalTape(file);
    } else {
        window.alert('Unknown file type: ' + ext);
    }
}

function doLoadLocalDisk(drive, file) {
    var fileReader = new FileReader();
    fileReader.onload = function() {
        var parts = file.name.split('.');
        var ext = parts.pop().toLowerCase();
        var name = parts.join('.');
        if (disk2.setBinary(drive, name, ext, this.result)) {
            drivelights.label(drive, name);
            initGamepad();
        }
    };
    fileReader.readAsArrayBuffer(file);
}

function doLoadHTTP(drive, _url) {
    var url = _url || document.querySelector('#http_url').value;
    if (url) {
        var req = new XMLHttpRequest();
        req.open('GET', url, true);
        req.responseType = 'arraybuffer';

        req.onload = function() {
            var urlParts = url.split('/');
            var file = urlParts.pop();
            var fileParts = file.split('.');
            var ext = fileParts.pop().toLowerCase();
            var name = decodeURIComponent(fileParts.join('.'));
            if (disk2.setBinary(drive, name, ext, req.response)) {
                drivelights.label(drive, name);
                MicroModal.close('http-modal');
                initGamepad();
            }
        };
        req.send(null);
    }
}

function openLoadHTTP(drive) {
    _currentDrive = parseInt(drive, 10);
    MicroModal.show('http-modal');
}

function openManage() {
    MicroModal.show('manage-modal');
}

var prefs = new Prefs();
var romVersion = prefs.readPref('computer_type2');
var multiScreen = false;
var rom;
var char_rom = apple2_charset;
switch (romVersion) {
case 'apple2':
    rom = new IntBASIC();
    break;
case 'original':
    rom = new OriginalROM();
    break;
case 'apple2jplus':
    rom = new Apple2jROM();
    char_rom = apple2j_charset;
    break;
case 'apple2pig':
    rom = new Apple2ROM();
    char_rom = pigfont_charset;
    break;
case 'apple2lc':
    rom = new Apple2ROM();
    char_rom = apple2lc_charset;
    break;
default:
    rom = new Apple2ROM();
}

var runTimer = null;
var cpu = new CPU6502();

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

var gr = new LoresPage(1, char_rom, false, context1);
var gr2 = new LoresPage(2, char_rom, false, context2);
var hgr = new HiresPage(1, context3);
var hgr2 = new HiresPage(2, context4);

var ram1 = new RAM(0x00, 0x03),
    ram2 = new RAM(0x0C, 0x1F),
    ram3 = new RAM(0x60, 0xBF);


var vm = new VideoModes(gr, hgr, gr2, hgr2, false);
vm.multiScreen(multiScreen);
var dumper = new ApplesoftDump(cpu);

var drivelights = new DriveLights();
var io = new Apple2IO(cpu, vm);
var keyboard = new KeyBoard(cpu, io);
var audio = new Audio(io);
var tape = new Tape(io);
var printer = new Printer('#printer-modal .paper');

var lc = new LanguageCard(io, 0, rom);
var parallel = new Parallel(io, 1, printer);
var slinky = new RAMFactor(io, 2, 1024 * 1024);
var videoterm = new Videoterm(io, 3, context1);
var disk2 = new DiskII(io, 6, drivelights);
var clock = new Thunderclock(io, 7);

cpu.addPageHandler(ram1);
cpu.addPageHandler(gr);
cpu.addPageHandler(gr2);
cpu.addPageHandler(ram2);
cpu.addPageHandler(hgr);
cpu.addPageHandler(hgr2);
cpu.addPageHandler(ram3);
cpu.addPageHandler(io);
cpu.addPageHandler(lc);

io.setSlot(0, lc);
io.setSlot(1, parallel);
io.setSlot(2, slinky);
io.setSlot(3, videoterm);
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

function dumpDisk(drive) {
    var wind = window.open('', '_blank');
    wind.document.title = drivelights.label(drive);
    wind.document.write('<pre>');
    wind.document.write(disk2.getJSON(drive, true));
    wind.document.write('</pre>');
    wind.document.close();
}

export function dumpProgram() {
    var wind = window.open('', '_blank');
    wind.document.title = 'Program Listing';
    wind.document.write('<pre>');
    wind.document.write(dumper.toString());
    wind.document.write('</pre>');
    wind.document.close();
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
        if (!loading) {
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
            if (io.annunciator(0)) {
                if (multiScreen) {
                    vm.blit();
                }
                if (videoterm.blit()) {
                    renderedFrames++;
                }
            } else {
                if (vm.blit()) {
                    renderedFrames++;
                }
            }
            io.tick();
        }

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
        ram1: ram1.getState(),
        ram2: ram2.getState(),
        ram3: ram3.getState(),
        io: io.getState(),
        lc: lc.getState(),
        vm: vm.getState(),
        disk2: disk2.getState(),
        drivelights: drivelights.getState()
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
    ram1.setState(state.ram1);
    ram2.setState(state.ram2);
    ram3.setState(state.ram3);
    io.setState(state.io);
    lc.setState(state.lc);
    vm.setState(state.vm);
    disk2.setState(state.disk2);
    drivelights.setState(state.drivelights);
    if (slinky && state.slinky) {
        slinky.setState(state.slinky);
    }
}

function loadBinary(bin) {
    stop();
    for (var idx = 0; idx < bin.length; idx++) {
        var pos = bin.start + idx;
        cpu.write(pos >> 8, pos & 0xff, bin.data[idx]);
    }
    run(bin.start);
}

export function selectCategory() {
    document.querySelector('#disk_select').innerHTML = '';
    var cat = disk_categories[document.querySelector('#category_select').value];
    if (cat) {
        for (var idx = 0; idx < cat.length; idx++) {
            var file = cat[idx], name = file.name;
            if (file.disk) {
                name += ' - ' + file.disk;
            }
            var option = document.createElement('option');
            option.value = file.filename;
            option.innerText = name;
            document.querySelector('#disk_select').append(option);
            if (disk_cur_name[_currentDrive] == name) {
                option.selected = true;
            }
        }
    }
}

export function selectDisk() {
    document.querySelector('#local_file').value = '';
}

export function clickDisk() {
    doLoad();
}

function loadDisk(drive, disk) {
    var name = disk.name;
    var category = disk.category;

    if (disk.disk) {
        name += ' - ' + disk.disk;
    }

    disk_cur_cat[drive] = category;
    disk_cur_name[drive] = name;

    drivelights.label(drive, name);
    disk2.setDisk(drive, disk);
    initGamepad(disk.gamepad);
}

/*
 *  LocalStorage Disk Storage
 */

function updateLocalStorage() {
    var diskIndex = JSON.parse(window.localStorage.diskIndex || '{}');
    var names = [], name, cat;

    for (name in diskIndex) {
        if (diskIndex.hasOwnProperty(name)) {
            names.push(name);
        }
    }

    cat = disk_categories['Local Saves'] = [];
    document.querySelector('#manage-modal-content').innerHTML = '';

    names.forEach(function(name) {
        cat.push({
            'category': 'Local Saves',
            'name': name,
            'filename': 'local:' + name
        });
        document.querySelector('#manage-modal-content').innerHTML =
            '<span class="local_save">' +
            name +
            ' <a href="#" onclick="doDelete(\'' +
            name +
            '\')">Delete</a><br /></span>';
    });
    cat.push({
        'category': 'Local Saves',
        'name': 'Manage Saves...',
        'filename': 'local:__manage'
    });
}

function saveLocalStorage(drive, name) {
    var diskIndex = JSON.parse(window.localStorage.diskIndex || '{}');

    var json = disk2.getJSON(drive);
    diskIndex[name] = json;

    window.localStorage.diskIndex = JSON.stringify(diskIndex);

    window.alert('Saved');

    drivelights.label(drive, name);
    drivelights.dirty(drive, false);
    updateLocalStorage();
}

function deleteLocalStorage(name) {
    var diskIndex = JSON.parse(window.localStorage.diskIndex || '{}');
    if (diskIndex[name]) {
        delete diskIndex[name];
        window.alert('Deleted');
    }
    window.localStorage.diskIndex = JSON.stringify(diskIndex);
    updateLocalStorage();
}

function loadLocalStorage(drive, name) {
    var diskIndex = JSON.parse(window.localStorage.diskIndex || '{}');
    if (diskIndex[name]) {
        disk2.setJSON(drive, diskIndex[name]);
        drivelights.label(drive, name);
        drivelights.dirty(drive, false);
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
            document.querySelectorAll('.inset').forEach((el) => el.classList.toggle('hidden'));
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
    }
}

function _keyup(evt) {
    if (!focused)
        io.keyUp();

    if (evt.keyCode == 16) { // Shift
        keyboard.shiftKey(false);
    } else if (evt.keyCode == 17) { // Control
        keyboard.controlKey(false);
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
    var offset = { top: s.clientTop, left: s.clientLeft };
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

    if (window.localStorage !== undefined) {
        document.querySelectorAll('.disksave').forEach(function (el) { el.style.display = 'inline-block';});
    }

    var oldcat = '';
    var option;
    for (var idx = 0; idx < window.disk_index.length; idx++) {
        var file = window.disk_index[idx];
        var cat = file.category;
        var name = file.name, disk = file.disk;
        if (file.e) {
            continue;
        }
        if (cat != oldcat) {
            option = document.createElement('option');
            option.value = cat;
            option.innerText = cat;
            document.querySelector('#category_select').append(option);

            disk_categories[cat] = [];
            oldcat = cat;
        }
        disk_categories[cat].push(file);
        if (disk) {
            if (!disk_sets[name]) {
                disk_sets[name] = [];
            }
            disk_sets[name].push(file);
        }
    }
    option = document.createElement('option');
    option.innerText = 'Local Saves';
    document.querySelector('#category_select').append(option);

    updateLocalStorage();
    initGamepad();

    // Check for disks in hashtag

    var hash = gup('disk') || hup();
    if (hash) {
        processHash(hash);
    }

    if (navigator.standalone) {
        document.body.classList.add('standalone');
    }

    var reptKey = document.querySelector('.key-REPT');
    reptKey.addEventListener('click', function() {
        document.querySelector('#keyboard').style.display = 'none';
        document.querySelector('#textarea').style.display = 'block';
        document.querySelector.focus();
    });
    document.querySelector('#text_input').addEventListener('keydown', function() {
        focused = document.querySelector('#buffering').checked;
    });
    document.querySelector('#text_input').addEventListener('keyup', function() {
        focused = document.querySelector('#buffering').checked;
    });

    run();
});
