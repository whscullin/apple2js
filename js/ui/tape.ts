
import { TapeData } from '../types';
import Apple2IO from '../apple2io';
import { debug } from '../util';

export const TAPE_TYPES = ['wav', 'aiff', 'aif', 'mp3', 'm4a'] as const;

export default class Tape {
    constructor(private readonly io: Apple2IO) {}

    public doLoadLocalTape(file: File, done?: () => void) {
        const kHz = this.io.getKHz();

        // Audio Buffer Source
        let context: AudioContext;
        if (AudioContext) {
            context = new AudioContext();
        } else {
            window.alert('Not supported by your browser');
            done && done();
            return;
        }

        const fileReader = new FileReader();
        fileReader.onload = (ev: ProgressEvent) => {
            const target: FileReader = ev.target as FileReader;
            const result: ArrayBuffer = target.result as ArrayBuffer;
            context.decodeAudioData(result).then((buffer) => {
                const buf: TapeData = [];
                const data = buffer.getChannelData(0);
                let datum = data[0];
                let old = (datum > 0.0), current;
                let last = 0;
                let delta: number;
                debug('Sample Count: ' + data.length);
                debug('Sample rate: ' + buffer.sampleRate);
                for (let idx = 1; idx < data.length; idx++) {
                    datum = data[idx];
                    if ((datum > 0.1) || (datum < -0.1)) {
                        current = (datum > 0.0);
                        if (current != old) {
                            delta = idx - last;
                            if (delta > 2000000) {
                                delta = 2000000;
                            }
                            let ival = delta / buffer.sampleRate * 1000;
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
                            buf.push([ival * kHz, current]);
                            old = current;
                            last = idx;
                        }
                    }
                }
                this.io.setTape(buf);
                if (done) {
                    done();
                }
            }, function (error) {
                window.alert(error.message);
            });
        };
        fileReader.readAsArrayBuffer(file);
    }
}
