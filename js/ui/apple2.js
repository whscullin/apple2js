import MicroModal from 'micromodal';
import DriveLights from './drive_lights';
import { DISK_TYPES } from '../cards/disk2';
import { initGamepad } from './gamepad';
import Tape, { TAPE_TYPES } from './tape';

import ApplesoftDump from '../applesoft/decompiler';
import ApplesoftCompiler from '../applesoft/compiler';

import { debug } from '../util';

var disk_categories = {'Local Saves': []};
var disk_sets = {};
var disk_cur_name = [];
var disk_cur_cat = [];

var _currentDrive = 1;
var _cpu, _tape, _disk2;

export const driveLights = new DriveLights();

export function initUI(cpu, io, disk2) {
    _cpu = cpu;
    _tape = new Tape(io);
    _disk2 = disk2;
}

function dumpDisk(drive) {
    var wind = window.open('', '_blank');
    wind.document.title = driveLights.label(drive);
    wind.document.write('<pre>');
    wind.document.write(_disk2.getJSON(drive, true));
    wind.document.write('</pre>');
    wind.document.close();
}

export function dumpProgram() {
    var dumper = new ApplesoftDump(_cpu);
    debug(dumper.toString());
}

export function compileProgram(program) {
    var compiler = new ApplesoftCompiler(_cpu);
    compiler.compile(program);
}

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

    var mimeType = 'application/octet-stream';
    var data = _disk2.getBinary(drive);
    var a = document.querySelector('#local_save_link');

    var blob = new Blob([data], { 'type': mimeType });
    a.href = window.URL.createObjectURL(blob);
    a.download = driveLights.label(drive) + '.dsk';

    if (event.metaKey) {
        dumpDisk(drive);
    } else {
        document.querySelector('#save_name').value = driveLights.label(drive);
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
        if (!_disk2.getMetadata(1)) {
            drive = 1;
        } else if (!_disk2.getMetadata(2)) {
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

export function loadAjax(drive, url) {
    MicroModal.show('loading-modal');

    fetch(url).then(function(response) {
        return response.json();
    }).then(function(data) {
        if (data.type == 'binary') {
            loadBinary(drive, data);
        } else if (DISK_TYPES.indexOf(data.type) > -1) {
            loadDisk(drive, data);
        }
        initGamepad(data.gamepad);
        MicroModal.close('loading-modal');
    }).catch(function(error) {
        window.alert(error || status);
        MicroModal.close('loading-modal');
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
        MicroModal.close('load-modal');
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
    if (DISK_TYPES.indexOf(ext) > -1) {
        doLoadLocalDisk(drive, file);
    } else if (TAPE_TYPES.indexOf(ext) > -1) {
        _tape.doLoadLocalTape(file);
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
        if (_disk2.setBinary(drive, name, ext, this.result)) {
            driveLights.label(drive, name);
            MicroModal.close('load-modal');
            initGamepad();
        }
    };
    fileReader.readAsArrayBuffer(file);
}

export function doLoadHTTP(drive, _url) {
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
            if (_disk2.setBinary(drive, name, ext, req.response)) {
                driveLights.label(drive, name);
                if (!_url) { MicroModal.close('http-modal'); }
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

function loadBinary(bin) {
    for (var idx = 0; idx < bin.length; idx++) {
        var pos = bin.start + idx;
        _cpu.write(pos >> 8, pos & 0xff, bin.data[idx]);
    }
    _cpu.reset();
    _cpu.setPC(bin.start);
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

    driveLights.label(drive, name);
    _disk2.setDisk(drive, disk);
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

    var json = _disk2.getJSON(drive);
    diskIndex[name] = json;

    window.localStorage.diskIndex = JSON.stringify(diskIndex);

    window.alert('Saved');

    driveLights.label(drive, name);
    driveLights.dirty(drive, false);
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
        _disk2.setJSON(drive, diskIndex[name]);
        driveLights.label(drive, name);
        driveLights.dirty(drive, false);
    }
}

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
