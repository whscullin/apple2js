/* -*- mode: JavaScript; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* Copyright 2010-2014 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

/*jshint jquery: true, browser: true */
/*globals io: false, toHex:false, debug: false */
/*exported playSample, enableSound, initAudio */

/*
 * Audio Handling
 */

var sound = true;

// 8000 = 0x1f40 = 64, 31
// 16000 = 0x3e80 = 128, 62

var wavHeader = 
    ['R','I','F','F',68 ,3  ,0  ,0  ,'W','A','V','E','f','m','t',' ',
     16 ,0  ,0  ,0  ,1  ,0  ,1  ,0  ,128,62 ,0  ,0  ,128,62 ,0  ,0  ,
     1  ,0  ,8  ,0  ,'d','a','t','a',32 ,3  ,0  ,0  ];

function percentEncode(ary) {
    var buf = "";
    for (var idx = 0; idx < ary.length; idx++) {
        buf += "%" + toHex(ary[idx]);
    }
    return buf;
}

wavHeader = $.map(wavHeader, function(n) {
                      return typeof(n) == "string" ? n.charCodeAt(0) : n;
                  });

var wavHeaderStr = percentEncode(wavHeader);

var audioAPI = false;
var audioMoz = false;
var audioContext;
var audioNode;
var audio, audio2;

function initAudio() {
    if (typeof window.webkitAudioContext != "undefined") {
        debug("Using Web Audio API");
        
        audioAPI = true;
        audioContext = new window.webkitAudioContext();
        audioNode = audioContext.createScriptProcessor(2048, 1, 1);
        io.floatAudio(audioContext.sampleRate);
        
        audioNode.onaudioprocess = function(event) {
            var data = event.outputBuffer.getChannelData(0);
            var sample = io.getSample();
            for (var idx = 0; idx < data.length; idx++) {
                if (idx < sample.length) {
                    data[idx] = sample[idx];
                } else {
                    data[idx] = 0;
                }
            }
        };
    } else {
        audio = document.createElement("audio");
        
        if (audio.mozSetup) {
            debug("Using Mozilla Audio API");
            audio.mozSetup(1, 16000);
            io.floatAudio(16000);
            audioMoz = true;
        } else {
            audio2 = document.createElement("audio");
        }
    }
}

function playSample() {
    // [audio,audio2] = [audio2,audio];
    
    var sample = io.getSample();
    
    if (!sound) {
        return;
    }
    
    if (audioMoz) {
        audio.mozWriteAudio(sample);
        return;
    }
    
    var tmp = audio;
    audio = audio2;
    audio2 = tmp;

    if (sample && sample.length) {
        var len = sample.length,
            buf = sample.join(""),
            o1 = percentEncode([(len + 36) & 0xff, (len + 36) >> 8]),
            o2 = percentEncode([len & 0xff, len >> 8]),
            header = wavHeaderStr.replace("%44%03",o1).replace("%20%03", o2); 

        audio.src = "data:audio/x-wav," + header + buf;
        // debug(audio.src);
        audio.play();
    }
}

function enableSound(on)
{
    sound = on;

    if (audioAPI) {
        if (sound) {
            audioNode.connect(audioContext.destination);
        } else {
            audioNode.disconnect();
        }
    } else {
        if (sound) {
            if (audio) audio.volume = 0.5;
            if (audio2) audio2.volume = 0.5;
        } else {
            io.getSample(true);
        }
    }
}

