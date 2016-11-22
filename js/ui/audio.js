/* Copyright 2010-2016 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

/*globals debug: false */
/*exported enableSound, initAudio */

/*
 * Audio Handling
 */

var sound = true;
var _samples = [];

var audioContext;
var audioNode;
var AC = window.AudioContext;

if (typeof AC !== 'undefined') {
    audioContext = new AC();
    audioNode = audioContext.createScriptProcessor(4096, 1, 1);

    audioNode.onaudioprocess = function(event) {
        var data = event.outputBuffer.getChannelData(0);
        var sample = _samples.shift();
        var idx = 0;

        var len = data.length;
        if (sample) {
            len = Math.min(sample.length, len);
            for (; idx < len; idx++) {
                data[idx] = sample[idx];
            }
        }

        for (; idx < data.length; idx++) {
            data[idx] = 0.0;
        }
    };

    /*
    // Create and specify parameters for the low-pass filter.
    var filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 11000;
    filter.connect(audioContext.destination);
    audioNode.connect(filter);
    */

    audioNode.connect(audioContext.destination);
}

function initAudio(io) {
    if (audioContext) {
        debug('Using Webkit Audio');
        io.sampleRate(audioContext.sampleRate);
        io.addSampleListener(function(sample) {
            if (sound) {
                _samples.push(sample);
                while (_samples.length > 5) {
                    _samples.shift();
                }
            }
        });
    }
}

function enableSound(enable) {
    sound = enable;
}
