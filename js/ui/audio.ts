import { BOOLEAN_OPTION, OptionHandler } from './options_modal';
import Apple2IO from '../apple2io';
import { debug } from '../util';

/*
 * Audio Handling
 */

const QUANTUM_SIZE = 128;
const SAMPLE_SIZE = 1024;
const SAMPLE_RATE = 44000;

export const SOUND_ENABLED_OPTION = 'enable_sound';

declare global {
    interface Window {
        webkitAudioContext: AudioContext;
    }
}

const AudioContext = window.AudioContext || window.webkitAudioContext;

export class Audio implements OptionHandler {
    private sound = true;
    private samples: number[][] = [];

    private audioContext;
    private audioNode;
    private workletNode: AudioWorkletNode;
    private started = false;

    ready: Promise<void>;

    constructor(io: Apple2IO) {
        this.audioContext = new AudioContext({
            sampleRate: SAMPLE_RATE
        });

        if (window.AudioWorklet) {
            this.ready = this.audioContext.audioWorklet.addModule('./dist/audio_worker.bundle.js');
            this.ready
                .then(() => {
                    this.workletNode = new AudioWorkletNode(this.audioContext, 'audio_worker');

                    io.sampleRate(this.audioContext.sampleRate, QUANTUM_SIZE);
                    io.addSampleListener((sample) => {
                        if (this.sound && this.audioContext.state === 'running') {
                            this.workletNode.port.postMessage(sample);
                        }
                    });
                    this.workletNode.connect(this.audioContext.destination);
                })
                .catch(console.error);
        } else {
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
            io.addSampleListener((sample) => {
                if (this.sound && this.audioContext.state === 'running') {
                    if (this.samples.length < 5) {
                        this.samples.push(sample);
                    }
                }
            });
            this.ready = Promise.resolve();
        }

        window.addEventListener('keydown', this.autoStart);
        if (window.ontouchstart !== undefined) {
            window.addEventListener('touchstart', this.autoStart);
        }
        window.addEventListener('mousedown', this.autoStart);

        debug('Sound initialized');
    }

    autoStart = () => {
        if (this.audioContext && !this.started) {
            this.samples = [];
            this.audioContext.resume().then(() => {
                this.started = true;
            }).catch((error) => {
                console.warn('audio not started', error);
            });
        }
    };

    start = () => {
        if (this.audioContext) {
            this.samples = [];
            this.audioContext.resume().catch((error) => {
                console.warn('audio not resumed', error);
            });
        }
    };

    isEnabled = () => {
        return this.sound;
    };

    getOptions() {
        return [
            {
                name: 'Audio',
                options: [
                    {
                        name: SOUND_ENABLED_OPTION,
                        label: 'Enabled',
                        type: BOOLEAN_OPTION,
                        defaultVal: true,
                    }
                ]
            }
        ];
    }

    setOption = (name: string, value: boolean) => {
        switch (name) {
            case SOUND_ENABLED_OPTION:
                this.sound = value;
        }
    };
}
