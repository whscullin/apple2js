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

/*jshint jquery: true, browser: true */
/*globals flipX: false, flipY: false */
/*exported processGamepad, initGamepad, gamepad */

var getGamepads = navigator.getGamepads || navigator.webkitGetGamepads;
var gamepad;
var gamepadMap = [];
var gamepadState = [];

var BUTTON = {
    // Buttons
    'A': 0,
    'B': 1,
    'X': 2,
    'Y': 3,

    // Triggers
    'L1': 4,
    'R1': 5,

    // Analog stick buttons
    'L3': 6,
    'R3': 7,

    // Special
    'START': 8,
    'SELECT': 9,
    'LOGO': 10,

    // D pad
    'UP': 11,
    'DOWN': 12,
    'LEFT': 13,
    'RIGHT': 14
};

var DEFAULT_GAMEPAD = {
    'A': 0,
    'B': 1,
    'L1': 0,
    'R1': 1,
    'START': '\033'
};

window.addEventListener('gamepadconnected', function(e) {
    gamepad = e.gamepad;
});

function processGamepad(io) {
    if (getGamepads) {
        gamepad = getGamepads.call(navigator)[0];
    }
    if (gamepad) {
        var x = (gamepad.axes[0] * 1.414 + 1) / 2.0;
        var y = (gamepad.axes[1] * 1.414 + 1) / 2.0;
        io.paddle(0, flipX ? 1.0 - x : x);
        io.paddle(1, flipY ? 1.0 - y : y);
        var val;
        for (var idx = 0; idx < gamepad.buttons.length; idx++) {
            val = gamepadMap[idx];
            if (val !== undefined) {
                var old = gamepadState[idx];
                var button = gamepad.buttons[idx];
                var pressed;
                if (typeof(button) == 'object') {
                    pressed = button.pressed;
                } else {
                    pressed = (button == 1.0);
                }

                if (pressed && !old) {
                    if (val <= 0) {
                        io.buttonDown(-val);
                    } else {
                        io.keyDown(gamepadMap[idx]);
                    }
                } else if (!pressed && old) {
                    if (val <= 0) {
                        io.buttonUp(-val);
                    } else {
                        io.keyUp();
                    }
                }
                gamepadState[idx] = pressed;
            }
        }
    }
}

function initGamepad(data) {
    for (var idx = 0; idx < 16; idx++) {
        gamepadMap[idx] = undefined;
    }
    var map = data || DEFAULT_GAMEPAD;
    $.each(map, function(key, val) {
        if (typeof val == 'string') {
            val = val.charCodeAt(0);
        } else {
            val = -val;
        }
        if (key in BUTTON) {
            gamepadMap[BUTTON[key]] = val;
        } else {
            gamepadMap[parseInt(key, 10)] = val;
        }
    });
}
