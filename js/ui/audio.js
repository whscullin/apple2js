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

/*
 * Audio Handling
 */

var SAMPLE_SIZE = 1024;
var SAMPLE_RATE = 44000;

export default function Audio(io) {
    var sound = true;
    var _samples = [];

    var audioContext;
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    var audioNode;
    var started = false;

    if (AudioContext) {
        audioContext = new AudioContext({
            sampleRate: SAMPLE_RATE
        });
        audioNode = audioContext.createScriptProcessor(SAMPLE_SIZE, 1, 1);

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

        audioNode.connect(audioContext.destination);
    }

    function _initAudio(io) {
        if (audioContext) {
            debug('Using Webkit Audio');
            io.sampleRate(audioContext.sampleRate, SAMPLE_SIZE);
            io.addSampleListener(function(sample) {
                if (sound) {
                    if (_samples.length < 5) {
                        _samples.push(sample);
                    }
                }
            });
        }
    }

    _initAudio(io);

    return {
        autoStart: function () {
            if (audioContext && !started) {
                _samples = [];
                audioContext.resume();
                started = true;
            }
        },

        start: function () {
            if (audioContext) {
                _samples = [];
                audioContext.resume();
            }
        },

        enable: function(enable) {
            sound = enable;
        }
    };
}
