/*globals debug */
/*exported Tape */

function Tape(io) {
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
                    done();
                });
            };
            fileReader.readAsArrayBuffer(file);
        }
    };
}
