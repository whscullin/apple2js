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
    private samples: Float32Array[] = [];

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
