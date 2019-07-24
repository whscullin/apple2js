/*global looker */

import Apple2IO from './apple2io';
import { HiresPage, LoresPage, VideoModes } from './canvas';
import CPU6502 from './cpu6502';
import MMU from './mmu';
import tableDisk from './table.json';
import graphDisk from './graph.json';

import Audio from './ui/audio';

import DiskII from './cards/disk2';
import RAMFactor from './cards/ramfactor';
import Thunderclock from './cards/thunderclock';

import apple2enh_charset from './roms/apple2enh_char';
import Apple2eEnhancedROM from './roms/apple2enh';

import { debug } from './util';
import { base64_decode, base64_encode } from './base64';

import { DOS33 } from 'apple-hack';

DOS33.prototype.rwts = function(track, sector, data) {
    if (data) {
        this.data[track][sector] = base64_encode(data);
    } else {
        data = base64_decode(this.data[track][sector]);
    }
    return data;
};

function DriveLights()
{
    return {
        driveLight: function() {},
        dirty: function() {},
        label: function() {},
        getState: function() {
            return {};
        },
        setState: function() {}
    };
}

var kHz = 1023;

var paused = false;

var enhanced = true;
var rom = new Apple2eEnhancedROM();
var char_rom = apple2enh_charset;

var runTimer = null;
var cpu = new CPU6502({'65C02': enhanced});

var disk2;
var io;

var oldBuffer = '';

looker.plugins.visualizations.add({
    create: function(element) {
        var title = document.createElement('h3');
        var frame = document.createElement('div');
        var canvas = document.createElement('canvas');
        var link = document.createElement('a');

        element.style.textAlign = 'center';
        element.parentNode.style.backgroundColor = '#c4c1a0';

        title.innerText = 'Apple ][';

        frame.style.display = 'block';
        frame.style.width = '560px';
        frame.style.height = '384px';
        frame.style.margin = 'auto';
        frame.style.background = 'black';
        frame.style.padding = '20px';

        canvas.setAttribute('width', 560);
        canvas.setAttribute('height', 384);

        link.style.fontFamily = 'monospace';
        link.innerText = 'Download';
        link.id= 'local_save_link';

        frame.append(canvas);
        element.append(title);
        element.append(frame);
        element.append(link);

        var context = canvas.getContext('2d');

        var gr = new LoresPage(1, char_rom, true, context);
        var gr2 = new LoresPage(2, char_rom, true, context);
        var hgr = new HiresPage(1, context);
        var hgr2 = new HiresPage(2, context);

        var vm = new VideoModes(gr, hgr, gr2, hgr2, true);
        vm.enhanced(enhanced);
        vm.multiScreen(false);

        var drivelights = new DriveLights();
        io = new Apple2IO(cpu, vm);
        var audio = new Audio(io);

        var mmu = new MMU(cpu, vm, gr, gr2, hgr, hgr2, io, rom);

        audio.enable(true);

        cpu.addPageHandler(mmu);

        var slinky = new RAMFactor(io, 2, 1024 * 1024);
        disk2 = new DiskII(io, 6, drivelights);
        var clock = new Thunderclock(io, 7);

        io.setSlot(2, slinky);
        io.setSlot(6, disk2);
        io.setSlot(7, clock);

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

                mmu.resetVB();
                cpu.stepCycles(step);
                vm.blit();
                io.tick();

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

        cpu.reset();
        run();
    },

    update: function(data, element, config, queryResponse, details) {
        var disk = tableDisk;
        switch (config.chart_type) {
        case 'graph':
            disk = graphDisk;
            break;
        }
        var work = new DOS33(disk.data);
        var file = work.files.find((f) => f.name.indexOf('LOOKER DATA') === 0);

        var title = queryResponse.fields.dimension_like[0].view_label;
        var dimension = queryResponse.fields.dimension_like[0].field_group_variant;
        var measure = queryResponse.fields.measure_like[0].field_group_variant;
        var dimension_key = queryResponse.fields.dimension_like[0].name;
        var measure_key = queryResponse.fields.measure_like[0].name;

        var values = [
            config.chart_type,
            title,
            `${dimension}, ${measure}`
        ];

        for (var idx = 0; idx < 19 && idx < data.length; idx++) {
            var row = data[idx];
            debug(row);
            values.push(`${row[dimension_key].value}, ${row[measure_key].value}`);
        }
        values.push('_, 0', '');
        var buffer = values.join('\r');
        debug(buffer);

        work.writeFile(file, {
            data: buffer.split('').map(c => (c.charCodeAt(0) | 0x80))
        });
        disk2.setDisk(1, disk);

        debug(data, config, queryResponse, details);

        var mimetype = 'application/octet-stream';
        var downloadData = disk2.getBinary(1);
        var a = document.querySelector('#local_save_link');

        var blob = new Blob([downloadData], { 'type': mimetype });
        a.href = window.URL.createObjectURL(blob);
        a.download = 'looker.dsk';

        if (oldBuffer && buffer !== oldBuffer) {
            cpu.write(0x3, 0xf3, 0xe0);
            cpu.reset();
        }
        oldBuffer = buffer;
    },

    options: {
        chart_type: {
            type: 'string',
            label: 'Chart Type',
            display: 'select',
            values: [
                {'Table': 'table'},
                {'Graph': 'graph'}
            ],
            default: 'table'
        }
    }
});
