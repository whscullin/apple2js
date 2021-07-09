/* Copyright 2021 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

declare global {
    interface AudioWorkletProcessor {
        readonly port: MessagePort;
        process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Map<string, Float32Array>): void;
    }

    const AudioWorkletProcessor: {
        prototype: AudioWorkletProcessor;
        new(options?: AudioWorkletNodeOptions): AudioWorkletProcessor;
    };

    function registerProcessor(name: string, ctor :{ new(): AudioWorkletProcessor; }): void
}

export class AppleAudioProcessor extends AudioWorkletProcessor {
    private samples: Float32Array[] = []

    constructor() {
        super();
        console.info('AppleAudioProcessor constructor');
        this.port.onmessage = (ev: MessageEvent) => {
            this.samples.push(ev.data);
            if (this.samples.length > 256) {
                this.samples.shift();
            }
        };
    }

    static get parameterDescriptors() {
        return [];
    }

    process(_inputList: Float32Array[][], outputList: Float32Array[][], _parameters: Map<string, Float32Array>) {
        const sample = this.samples.shift();
        const output = outputList[0];
        if (sample) {
            for (let idx = 0; idx < sample.length; idx++) {
                output[0][idx] = sample[idx];
            }
        }

        // Keep alive indefinitely.
        return true;
    }
}

registerProcessor('audio_worker', AppleAudioProcessor);
