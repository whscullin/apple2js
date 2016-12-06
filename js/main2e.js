/* globals debug: false, gup: false, hup: false, toHex: false
           CPU6502: false,
           Apple2eROM: false, Apple2eEnhancedROM: false,
           apple2e_charset: false,
           Apple2IO: false
           LoresPage: false, HiresPage: false, VideoModes: false,
           scanlines: true,
           KeyBoard: false,
           Parallel: false,
           DiskII: false,
           Printer: false,
           MMU: false,
           Slot3: false,
           RAMFactor: false,
           Thunderclock: false,
           Prefs: false,
           disk_index: false,
           initAudio: false, enableSound: false,
           initGamepad: false, processGamepad: false, gamepad: false,
           ApplesoftDump: false, SYMBOLS: false,
*/
/* exported openLoad, openSave, doDelete,
            selectCategory, selectDisk, clickDisk,
            updateJoystick,
            pauseRun, step,
            restoreState, saveState,
            dumpProgram, PageDebug
*/

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

var DISK_TYPES = ['dsk','do','po','raw','nib','2mg'];
var TAPE_TYPES = ['wav','aiff','aif','mp3'];

var _currentDrive = 1;

function openLoad(drive, event)
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
}

function openSave(drive, event)
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
}

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
        doLoadLocal(_currentDrive);
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

function doDelete(name) {
    if (window.confirm('Delete ' + name + '?')) {
        deleteLocalStorage(name);
    }
}

function doLoadLocal(drive) {
    var files = $('#local_file').prop('files');
    if (files.length == 1) {
        var file = files[0];
        var parts = file.name.split('.');
        var ext = parts[parts.length - 1].toLowerCase();
        if ($.inArray(ext, DISK_TYPES) >= 0) {
            doLoadLocalDisk(drive, file);
        } else if ($.inArray(ext, TAPE_TYPES) >= 0) {
            doLoadLocalTape(file);
        } else {
            window.alert('Unknown file type: ' + ext);
            $('#load').dialog('close');
        }
    }
}

function doLoadLocalDisk(drive, file) {
    var fileReader = new FileReader();
    fileReader.onload = function() {
        var parts = file.name.split('.');
        var name = parts[0], ext = parts[parts.length - 1].toLowerCase();
        if (disk2.setBinary(drive, name, ext, this.result)) {
            drivelights.label(drive, name);
            $('#load').dialog('close');
            initGamepad();
        }
    };
    fileReader.readAsArrayBuffer(file);
}

function doLoadLocalTape(file) {
    // Audio Buffer Source
    var context;
    if (typeof window.AudioContext != 'undefined') {
        context = new window.AudioContext();
    } else {
        window.alert('Not supported by your browser');
        $('#load').dialog('close');
        return;
    }

    var fileReader = new FileReader();
    fileReader.onload = function(ev) {
        context.decodeAudioData(ev.target.result, function(buffer) {
            var buf = [];
            var data = buffer.getChannelData(0), datum = data[0];
            var old = (datum > 0.0), current;
            var last = 0, delta, ival;
            debug('Sample Count: ' + data.length);
            debug('Sample rate: ' + buffer.sampleRate);
            for (var idx = 1; idx < data.length; idx++) {
                datum = data[idx];
                if ((datum > 0.1) || (datum < -0.1)) {
                    current = (datum > 0.0);
                    if (current != old) {
                        delta = idx - last;
                        if (delta > 2000000) {
                            delta = 2000000;
                        }
                        ival = delta / buffer.sampleRate * 1000;
                        if (ival >= 0.550 && ival < 0.750) {
                            ival = 0.650; // Header
                        } else if (ival >= 0.175 && ival < 0.225) {
                            ival = 0.200; // sync 1
                        } else if (ival >= 0.225 && ival < 0.275) {
                            ival = 0.250; // 0 / sync 2
                        } else if (ival >= 0.450 && ival < 0.550) {
                            ival = 0.500; // 1
                        } else {
                            // debug(idx + ' ' + buf.length + ' ' + ival);
                        }
                        buf.push(parseInt(ival * kHz));
                        old = current;
                        last = idx;
                    }
                }
            }
            io.setTape(buf);
            $('#load').dialog('close');
        });
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
            var parts = url.split(/[\/\.]/);
            var name = decodeURIComponent(parts[parts.length - 2]);
            var ext = parts[parts.length - 1].toLowerCase();
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
var enhanced = prefs.readPref('computer_type') != 'apple2e';
var runTimer = null;

var cpu = new CPU6502({'65C02': enhanced});

var hgr = new HiresPage(1);
var hgr2 = new HiresPage(2);
var gr = new LoresPage(1, apple2e_charset);
var gr2 = new LoresPage(2, apple2e_charset);

var rom;
if (enhanced) {
    rom = new Apple2eEnhancedROM();
} else {
    rom = new Apple2eROM();
}

var vm = new VideoModes(gr, hgr, gr2, hgr2);
var dumper = new ApplesoftDump(cpu);

var drivelights = new DriveLights();
var io = new Apple2IO(cpu, vm);
var keyboard = new KeyBoard(io);

var mmu = new MMU(cpu, gr, gr2, hgr, hgr2, io, rom);

cpu.addPageHandler(mmu);

var parallel = new Parallel(io, 1, new Printer());
var slinky = new RAMFactor(io, 2, 1024 * 1024);
var slot3 = new Slot3(io, 3, rom);
var disk2 = new DiskII(io, 6, drivelights);
var clock = new Thunderclock(io, 7);

io.addSlot(1, parallel);
io.addSlot(2, slinky);
io.addSlot(3, slot3);
io.addSlot(6, disk2);
io.addSlot(7, clock);

var showFPS = false;

function updateKHz() {
    var now = Date.now();
    var ms = now - startTime;
    var cycles = cpu.cycles();
    var delta;

    if (showFPS) {
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

/* Audio Handling */
initAudio(io);

function updateSound() {
    enableSound($('#enable_sound').attr('checked'));
}

function dumpDisk(drive) {
    var wind = window.open('', '_blank');
    wind.document.title = drivelights.label(drive);
    wind.document.write('<pre>');
    wind.document.write(disk2.getJSON(drive, true));
    wind.document.write('</pre>');
    wind.document.close();
}

function dumpProgram() {
    var wind = window.open('', '_blank');
    wind.document.title = 'Program Listing';
    wind.document.write('<pre>');
    wind.document.write(dumper.toString());
    wind.document.write('</pre>');
    wind.document.close();
}

function step()
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

function updateCPU()
{
    accelerated = $('#accelerator_toggle').prop('checked');
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
        renderedFrames++;

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
            vm.blit();
            io.sampleTick();
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
        io: io.getState(),
        mmu: mmu.getState(),
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
    io.setState(state.io);
    mmu.setState(state.mmu);
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

function selectCategory() {
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
}

function selectDisk() {
    $('#local_file').val('');
}

function clickDisk() {
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
    $('#manage').empty();

    names.forEach(function(name) {
        cat.push({'category': 'Local Saves',
                  'name': name,
                  'filename': 'local:' + name});
        $('#manage').append('<span class="local_save">' +
                            name +
                            ' <a href="#" onclick="doDelete(\'' +
                            name +
                            '\')">Delete</a><br /></span>');
    });
    cat.push({'category': 'Local Saves',
              'name': 'Manage Saves...',
              'filename': 'local:__manage'});
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
    if (!focused) {
        evt.preventDefault();

        var key = keyboard.mapKeyEvent(evt);
        if (key != 0xff) {
            io.keyDown(key, evt.shiftKey);
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
    } else if (evt.keyCode == 16) { // Shift
        keyboard.shiftKey(true);
        io.buttonDown(2);
    } else if (evt.keyCode == 17) { // Control
        keyboard.controlKey(true);
    } else if (evt.keyCode == 91 || evt.keyCode == 93) { // Command
        keyboard.commandKey(true);
    } else if (evt.keyCode == 18) { // Alt
        keyboard.optionKey(true);
    }
}

function _keyup(evt) {
    if (!focused)
        io.keyUp();

    if (evt.keyCode == 16) { // Shift
        keyboard.shiftKey(false);
        io.buttonUp(2);
    } else if (evt.keyCode == 17) { // Control
        keyboard.controlKey(false);
    } else if (evt.keyCode == 91 || evt.keyCode == 93) { // Command
        keyboard.commandKey(false);
    } else if (evt.keyCode == 18) { // Alt
        keyboard.optionKey(false);
    }
}

function updateScreen() {
    var green = $('#green_screen').prop('checked');
    scanlines = $('#show_scanlines').prop('checked');

    vm.green(green);
}

var disableMouseJoystick = false;
var flipX = false;
var flipY = false;
var swapXY = false;

function updateJoystick() {
    disableMouseJoystick = $('#disable_mouse').prop('checked');
    flipX = $('#flip_x').prop('checked');
    flipY = $('#flip_y').prop('checked');
    swapXY = $('#swap_x_y').prop('checked');

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

function pauseRun(b) {
    if (paused) {
        run();
        b.value = 'Pause';
    } else {
        stop();
        b.value = 'Run';
    }
    paused = !paused;
}

$(function() {
    hashtag = document.location.hash;

    $('button,input[type=button],a.button').button().focus(function() {
        // Crazy hack required by Chrome
        var self = this;
        window.setTimeout(function() {
            self.blur();
        }, 1);
    });

    var canvas = document.getElementById('screen');
    var context = canvas.getContext('2d');

    vm.setContext(context);

    /*
     * Input Handling
     */

    $(window).keydown(_keydown);
    $(window).keyup(_keyup);

    $('canvas').mousedown(function(evt) {
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

    $('body > div').hover(function() { focused = false; },
                          function() { focused = true; });

    $('input,textarea').focus(function() { focused = true; })
                       .blur(function() { focused = false; });

    keyboard.create($('#keyboard'));

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
    run();
    setInterval(updateKHz, 1000);
    updateSound();
    updateScreen();
    updateCPU();

    var cancel = function() { $(this).dialog('close'); };
    $('#loading').dialog({ autoOpen: false, modal: true });
    $('#options').dialog({ autoOpen: false,
                           modal: true,
                           width: 320,
                           height: 400,
                           buttons: {'Close': cancel }});
    $('#load').dialog({ autoOpen: false,
                        modal: true,
                        width: 540,
                        buttons: {'Cancel': cancel, 'Load': doLoad }});
    $('#save').dialog({ autoOpen: false,
                        modal: true,
                        width: 320,
                        buttons: {'Cancel': cancel, 'Save': doSave }});
    $('#manage').dialog({ autoOpen: false,
                          modal: true,
                          width: 320,
                          buttons: {'Close': cancel }});
    $('#http_load').dialog({ autoOpen: false,
                             modal: true,
                             width: 530,
                             buttons: {'Cancel': cancel, 'OK': doLoadHTTP }});

    if (window.localStorage !== undefined) {
        $('.disksave').show();
    }

    var oldcat = '';
    for (var idx = 0; idx < disk_index.length; idx++) {
        var file = disk_index[idx];
        var cat = file.category;
        var name = file.name, disk = file.disk;
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

});
