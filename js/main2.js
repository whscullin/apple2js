import Apple2IO from './apple2io';
import ApplesoftDump from './applesoft/decompiler';
import { HiresPage, LoresPage, VideoModes, multiScreen } from './canvas';
import CPU6502 from './cpu6502';
import Prefs from './prefs';
import RAM from './ram';
import { debug, gup, hup } from './util';

import Audio from './ui/audio';
import { gamepad, configGamepad, initGamepad, processGamepad } from './ui/gamepad';
import KeyBoard from './ui/keyboard';
import Printer from './ui/printer';
import Tape from './ui/tape';

import DiskII from './cards/disk2';
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

/*
 * Page viewer
 */

/*
function PageDebug(page)
{
    var _page = page;

    function _init() {
        var r, c;
        var row = $('<tr />').appendTo('#page' + toHex(_page));
        $('<th>\\</th>').appendTo(row);
        for (c = 0; c < 16; c++) {
            $('<th>' + toHex(c) + '</th>').appendTo(row);
        }
        for (r = 0; r < 16; r++) {
            row = $('<tr />').appendTo('#page' + toHex(_page));
            $('<th>' + toHex(r * 16) + '</th>').appendTo(row);
            for (c = 0; c < 16; c++) {
                $('<td>--</td>').appendTo(row).attr('id', 'page' + toHex(_page) + '-' + toHex(r * 16 + c));
            }
        }
    }

    _init();

    return {
        start: function() { return _page; },
        end: function() { return _page; },
        read: null,
        write: function(page, off, val) {
            $('#page' + toHex(page) + '-' + toHex(off)).text(toHex(val));
        }
    };
}
*/

var disk_categories = {'Local Saves': []};
var disk_sets = {};
var disk_cur_name = [];
var disk_cur_cat = [];

function DriveLights()
{
    return {
        driveLight: function(drive, on) {
            $('#disk' + drive).css('background-image',
                on ? 'url(css/red-on-16.png)' :
                    'url(css/red-off-16.png)');
        },
        dirty: function() {
            // $('#disksave' + drive).button('option', 'disabled', !dirty);
        },
        label: function(drive, label) {
            if (label) {
                $('#disklabel' + drive).text(label);
            }
            return $('#disklabel' + drive).text();
        },
        getState: function() {
            return {
                disks: [
                    this.label(1),
                    this.label(2)
                ]
            };
        },
        setState: function(state) {
            if (state && state.disks) {
                this.label(1, state.disks[0].label);
                this.label(2, state.disks[1].label);
            }
        }
    };
}

var DISK_TYPES = ['dsk','d13','do','po','raw','nib','2mg'];
var TAPE_TYPES = ['wav','aiff','aif','mp3','m4a'];

var _currentDrive = 1;

window.openLoad = function(drive, event)
{
    _currentDrive = parseInt(drive, 10);
    if (event.metaKey) {
        openLoadHTTP(drive);
    } else {
        if (disk_cur_cat[drive]) {
            $('#category_select').val(disk_cur_cat[drive]).change();
        }
        $('#load').dialog('open');
    }
};

window.openSave = function(drive, event)
{
    _currentDrive = parseInt(drive, 10);

    var mimetype = 'application/octet-stream';
    var data = disk2.getBinary(drive);
    var a = $('#local_save_link');

    var blob = new Blob([data], { 'type': mimetype });
    a.attr('href', window.URL.createObjectURL(blob));
    a.attr('download', drivelights.label(drive) + '.dsk');

    if (event.metaKey) {
        dumpDisk(drive);
    } else {
        $('#save_name').val(drivelights.label(drive));
        $('#save').dialog('open');
    }
};

window.handleDragOver = function(drive, event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
};

window.handleDragEnd = function(drive, event) {
    var dt = event.dataTransfer;
    if (dt.items) {
        for (var i = 0; i < dt.items.length; i++) {
            dt.items.remove(i);
        }
    } else {
        event.dataTransfer.clearData();
    }
};

window.handleDrop = function(drive, event) {
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
};

var loading = false;

function loadAjax(drive, url) {
    loading = true;
    $('#loading').dialog('open');

    $.ajax({
        url: url,
        dataType: 'json',
        modifiedSince: true,
        error: function(xhr, status, error) {
            alert(error || status);
            $('#loading').dialog('close');
            loading = false;
        },
        success: function(data) {
            if (data.type == 'binary') {
                loadBinary(drive, data);
            } else if ($.inArray(data.type, DISK_TYPES) >= 0) {
                loadDisk(drive, data);
            }
            initGamepad(data.gamepad);
            $('#loading').dialog('close');
            loading = false;
        }
    });
}

function doLoad() {
    var urls = $('#disk_select').val(), url;
    if (urls && urls.length) {
        if (typeof(urls) == 'string') {
            url = urls;
        } else {
            url = urls[0];
        }
    }

    var files = $('#local_file').prop('files');
    if (files.length == 1) {
        doLoadLocal(_currentDrive, files[0]);
    } else if (url) {
        var filename;
        $('#load').dialog('close');
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
            loadAjax(_currentDrive, url);
        }
    }
}

function doSave() {
    var name = $('#save_name').val();
    saveLocalStorage(_currentDrive, name);
    $('#save').dialog('close');
}

window.doDelete = function(name) {
    if (window.confirm('Delete ' + name + '?')) {
        deleteLocalStorage(name);
    }
};

function doLoadLocal(drive, file) {
    var parts = file.name.split('.');
    var ext = parts[parts.length - 1].toLowerCase();
    if ($.inArray(ext, DISK_TYPES) >= 0) {
        doLoadLocalDisk(drive, file);
    } else if ($.inArray(ext, TAPE_TYPES) >= 0) {
        tape.doLoadLocalTape(file, function() {
            $('#load').dialog('close');
        });
    } else {
        window.alert('Unknown file type: ' + ext);
        $('#load').dialog('close');
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
            $('#load').dialog('close');
            initGamepad();
        }
    };
    fileReader.readAsArrayBuffer(file);
}

function doLoadHTTP(drive, _url) {
    var url = _url || $('#http_url').val();
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
                $('#http_load').dialog('close');
                initGamepad();
            }
        };
        req.send(null);
    }
}

function openLoadHTTP(drive) {
    _currentDrive = parseInt(drive, 10);
    $('#http_load').dialog('open');
}

function openManage() {
    $('#manage').dialog('open');
}

var prefs = new Prefs();
var romVersion = prefs.readPref('computer_type2');
export var enhanced = false;
var rom;
var char_rom = apple2_charset;
switch (romVersion) {
case 'apple2':
    rom = new IntBASIC();
    break;
case'original':
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
var dumper = new ApplesoftDump(cpu);

var drivelights = new DriveLights();
var io = new Apple2IO(cpu, vm);
var keyboard = new KeyBoard(cpu, io);
var audio = new Audio(io);
var tape = new Tape(io);
var printer = new Printer($('#printer .paper'));

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

window.showFPS = false;

function updateKHz() {
    var now = Date.now();
    var ms = now - startTime;
    var cycles = cpu.cycles();
    var delta;

    if (window.showFPS) {
        delta = renderedFrames - lastFrames;
        var fps = parseInt(delta/(ms/1000), 10);
        $('#khz').text( fps + 'fps');
    } else {
        delta = cycles - lastCycles;
        var khz = parseInt(delta/ms);
        $('#khz').text( khz + 'KHz');
    }

    startTime = now;
    lastCycles = cycles;
    lastFrames = renderedFrames;
}

window.updateSound = function updateSound() {
    var on = $('#enable_sound').prop('checked');
    var label = $('#toggle-sound i');
    audio.enable(on);
    if (on) {
        label.removeClass('fa-volume-off').addClass('fa-volume-up');
    } else {
        label.removeClass('fa-volume-up').addClass('fa-volume-off');
    }
};

function dumpDisk(drive) {
    var wind = window.open('', '_blank');
    wind.document.title = drivelights.label(drive);
    wind.document.write('<pre>');
    wind.document.write(disk2.getJSON(drive, true));
    wind.document.write('</pre>');
    wind.document.close();
}

window.dumpProgram = function() {
    var wind = window.open('', '_blank');
    wind.document.title = 'Program Listing';
    wind.document.write('<pre>');
    wind.document.write(dumper.toString());
    wind.document.write('</pre>');
    wind.document.close();
};

window.step = function()
{
    if (runTimer) {
        clearInterval(runTimer);
    }
    runTimer = null;

    cpu.step(function() {
        debug(cpu.dumpRegisters());
        debug(cpu.dumpPC());
    });
};

var accelerated = false;

window.updateCPU = function updateCPU()
{
    accelerated = $('#accelerator_toggle').prop('checked');
    kHz = accelerated ? 4092 : 1023;
    io.updateHz(kHz * 1000);
    if (runTimer) {
        run();
    }
};

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

function reset()
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

window.selectCategory = function() {
    $('#disk_select').empty();
    var cat = disk_categories[$('#category_select').val()];
    if (cat) {
        for (var idx = 0; idx < cat.length; idx++) {
            var file = cat[idx], name = file.name;
            if (file.disk) {
                name += ' - ' + file.disk;
            }
            var option = $('<option />').val(file.filename).text(name)
                .appendTo('#disk_select');
            if (disk_cur_name[_currentDrive] == name) {
                option.attr('selected', 'selected');
            }
        }
    }
};

window.selectDisk = function() {
    $('#local_file').val('');
};

window.clickDisk = function() {
    doLoad();
};

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
    $('#manage').empty();

    names.forEach(function(name) {
        cat.push({
            'category': 'Local Saves',
            'name': name,
            'filename': 'local:' + name
        });
        $('#manage').append(
            '<span class="local_save">' +
            name +
            ' <a href="#" onclick="doDelete(\'' +
            name +
            '\')">Delete</a><br /></span>'
        );
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
    } else if (evt.keyCode === 113) { // F2 - Full Screen
        var elem = document.getElementById('screen');
        if (document.webkitCancelFullScreen) {
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

window.updateScreen = function updateScreen() {
    var green = $('#green_screen').prop('checked');
    var scanlines = $('#show_scanlines').prop('checked');

    vm.green(green);
    vm.scanlines(scanlines);
};

var disableMouseJoystick = false;
var flipX = false;
var flipY = false;
var swapXY = false;

window.updateJoystick = function() {
    disableMouseJoystick = $('#disable_mouse').prop('checked');
    flipX = $('#flip_x').prop('checked');
    flipY = $('#flip_y').prop('checked');
    swapXY = $('#swap_x_y').prop('checked');
    configGamepad(flipX, flipY);

    if (disableMouseJoystick) {
        io.paddle(0, 0.5);
        io.paddle(1, 0.5);
        return;
    }
};

function _mousemove(evt) {
    if (gamepad || disableMouseJoystick) {
        return;
    }

    var s = $('#screen');
    var offset = s.offset();
    var x = (evt.pageX - offset.left) / s.width(),
        y = (evt.pageY - offset.top) / s.height(),
        z = x;

    if (swapXY) {
        x = y;
        y = z;
    }

    io.paddle(0, flipX ? 1 - x : x);
    io.paddle(1, flipY ? 1 - y : y);
}

window.pauseRun = function() {
    var label = $('#pause-run i');
    if (paused) {
        run();
        label.removeClass('fa-play').addClass('fa-pause');
    } else {
        stop();
        label.removeClass('fa-pause').addClass('fa-play');
    }
    paused = !paused;
};

window.toggleSound = function() {
    var enableSound = $('#enable_sound');
    enableSound.prop('checked', !enableSound.prop('checked'));
    window.updateSound();
};

$(function() {
    hashtag = document.location.hash;

    $('button,input[type=button],a.button').button().focus(function() {
        // Crazy hack required by Chrome
        var self = this;
        window.setTimeout(function() {
            self.blur();
        }, 1);
    });

    /*
     * Input Handling
     */

    $(window)
        .keydown(_keydown)
        .keyup(_keyup)
        .mousedown(function() { audio.autoStart(); });

    $('canvas')
        .mousedown(function(evt) {
            if (!gamepad) {
                io.buttonDown(evt.which == 1 ? 0 : 1);
            }
            evt.preventDefault();
        })
        .mouseup(function(evt) {
            if (!gamepad) {
                io.buttonUp(evt.which == 1 ? 0 : 1);
            }
        })
        .bind('contextmenu', function(evt) { evt.preventDefault(); });

    $('body').mousemove(_mousemove);

    $('input,textarea')
        .focus(function() { focused = true; })
        .blur(function() { focused = false; });

    keyboard.create('#keyboard');

    if (prefs.havePrefs()) {
        $('#options input[type=checkbox]').each(function() {
            var val = prefs.readPref(this.id);
            if (val)
                this.checked = JSON.parse(val);
        }).change(function() {
            prefs.writePref(this.id, JSON.stringify(this.checked));
        });
        $('#options select').each(function() {
            var val = prefs.readPref(this.id);
            if (val)
                this.value = val;
        }).change(function() {
            prefs.writePref(this.id, this.value);
        });
    }

    reset();
    setInterval(updateKHz, 1000);
    window.updateSound();
    window.updateScreen();
    window.updateCPU();

    var cancel = function() { $(this).dialog('close'); };
    $('#loading').dialog({ autoOpen: false, modal: true });
    $('#options').dialog({
        autoOpen: false,
        modal: true,
        width: 320,
        buttons: {'Close': cancel }
    });
    $('#load').dialog({
        autoOpen: false,
        modal: true,
        width: 540,
        buttons: {'Cancel': cancel, 'Load': doLoad }
    });
    $('#save').dialog({
        autoOpen: false,
        modal: true,
        width: 320,
        buttons: {'Cancel': cancel, 'Save': doSave }
    });
    $('#manage').dialog({
        autoOpen: false,
        modal: true,
        width: 320,
        buttons: {'Close': cancel }
    });
    $('#printer').dialog({
        autoOpen: false,
        modal: true,
        resizeable: false,
        width: 570,
        buttons: {
            'Clear': printer.clear,
            'Close': cancel
        }
    });
    $('#http_load').dialog({
        autoOpen: false,
        modal: true,
        width: 530,
        buttons: {'Cancel': cancel, 'OK': doLoadHTTP }
    });

    if (window.localStorage !== undefined) {
        $('.disksave').show();
    }

    var oldcat = '';
    for (var idx = 0; idx < window.disk_index.length; idx++) {
        var file = window.disk_index[idx];
        var cat = file.category;
        var name = file.name, disk = file.disk;
        if (file.e) {
            continue;
        }
        if (cat != oldcat) {
            $('<option />').val(cat).text(cat).appendTo('#category_select');
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
    $('<option/>').text('Local Saves').appendTo('#category_select');

    updateLocalStorage();
    initGamepad();

    // Check for disks in hashtag

    var hash = gup('disk') || hup();
    if (hash) {
        processHash(hash);
    }

    if (navigator.userAgent.match(/(iPod|iPhone|iPad)/)) {
        $('select').removeAttr('multiple').css('height', 'auto');
    }

    if (navigator.standalone) {
        $('body').addClass('standalone');
    }

    $('.key-REPT').click(function() {
        $('#keyboard').hide();
        $('#textarea').show();
        $('#text_input').focus();
    });
    $('#text_input').keydown(function() {
        focused = $('#buffering').prop('checked');
    }).keyup(function() {
        focused = $('#buffering').prop('checked');
    });

    run();
});
