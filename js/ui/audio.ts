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

import Apple2IO from '../apple2io';
import { debug } from '../util';

/*
 * Audio Handling
 */

const SAMPLE_SIZE = 1024;
const SAMPLE_RATE = 44000;

const AudioContext = window.AudioContext || (window as any).webkitAudioContext;

export default class Audio {
    private sound = true;
    private samples: number[][] = [];

    private audioContext;
    private audioNode;
    private started = false;

    constructor(io: Apple2IO) {
        this.audioContext = new AudioContext({
            sampleRate: SAMPLE_RATE
        });

        // TODO(flan): MDN says that createScriptProcessor is deprecated and
        // replaced by AudioWorklet. FF and Chrome support AudioWorklet, but
        // Safari does not (yet).
        this.audioNode = this.audioContext.createScriptProcessor(SAMPLE_SIZE, 1, 1);

        this.audioNode.onaudioprocess = (event) => {
            const data = event.outputBuffer.getChannelData(0);
            const sample = this.samples.shift();
            let idx = 0;
            let len = data.length;

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

        this.audioNode.connect(this.audioContext.destination);
        io.sampleRate(this.audioContext.sampleRate, SAMPLE_SIZE);
        io.addSampleListener((sample: number[]) => {
            if (this.sound) {
                if (this.samples.length < 5) {
                    this.samples.push(sample);
                }
            }
        });
        debug('Sound initialized');
    }


    autoStart() {
        if (this.audioContext && !this.started) {
            this.samples = [];
            this.audioContext.resume();
            this.started = true;
        }
    }

    start() {
        if (this.audioContext) {
            this.samples = [];
            this.audioContext.resume();
        }
    }

    enable(enable: boolean) {
        this.sound = enable;
    }
}
