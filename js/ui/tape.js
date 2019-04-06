
/* Copyright 2010-2019 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

import { debug } from '../util';

export const TAPE_TYPES = ['wav','aiff','aif','mp3','m4a'];

export default function Tape(io) {
    var AudioContext = window.AudioContext || window.webkitAudioContext;

    return {
        doLoadLocalTape: function(file, done) {
            var kHz = io.getHz() / 1000;

            // Audio Buffer Source
            var context;
            if (AudioContext) {
                context = new AudioContext();
            } else {
                window.alert('Not supported by your browser');
                done();
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
                                buf.push([parseInt(ival * kHz), current]);
                                old = current;
                                last = idx;
                            }
                        }
                    }
                    io.setTape(buf);
                    if (done) {
                        done();
                    }
                });
            };
            fileReader.readAsArrayBuffer(file);
        }
    };
}
