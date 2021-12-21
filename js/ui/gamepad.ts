import Apple2IO from '../apple2io';
import { BUTTON, ButtonType, GamepadConfiguration } from './types';

export let gamepad: Gamepad | null = null;

const DEFAULT_GAMEPAD: GamepadConfiguration = {
    'A': 0,
    'B': 1,
    'L1': 0,
    'R1': 1,
    'START': '\x1B'
} as const;

/**
 * An array with 16 entries. For each entry _e_:
 *
 * *   if _e_ <= 0, then _-e_ is 0 | 1 | 2 and represents a joystick button;
 * *   if _e_ > 0, then _e_ is a key on the keyboard that is pressed;
 * *   if _e_ is undefined, nothing happens.
 */
const gamepadMap: Array<number | undefined> = [];
/**
 * An array with 16 entries saying whether or not the given button is
 * currently pressed.
 */
const gamepadState: boolean[] = [];
let flipX = false;
let flipY = false;


window.addEventListener('gamepadconnected', function (e: GamepadEvent) {
    gamepad = e.gamepad;
});

export function processGamepad(io: Apple2IO) {
    // Always use the first gamepad
    gamepad = navigator.getGamepads()[0];
    if (!gamepad) {
        return;
    }
    const x = (gamepad.axes[0] * 1.414 + 1) / 2.0;
    const y = (gamepad.axes[1] * 1.414 + 1) / 2.0;
    io.paddle(0, flipX ? 1.0 - x : x);
    io.paddle(1, flipY ? 1.0 - y : y);
    for (let idx = 0; idx < gamepad.buttons.length; idx++) {
        const val = gamepadMap[idx];
        if (val !== undefined) {
            const old = gamepadState[idx];
            const button = gamepad.buttons[idx];
            let pressed: boolean;
            if (typeof button === 'object') {
                pressed = button.pressed;
            } else {
                pressed = (button === 1.0);
            }

            if (pressed && !old) {
                if (val <= 0) {
                    io.buttonDown(-val as 0 | 1 | 2);
                } else {
                    io.keyDown(gamepadMap[idx]!);
                }
            } else if (!pressed && old) {
                if (val <= 0) {
                    io.buttonUp(-val as 0 | 1 | 2);
                } else {
                    io.keyUp();
                }
            }
            gamepadState[idx] = pressed;
        }
    }
}

export function configGamepad(configFlipX: boolean, configFlipY: boolean) {
    flipX = configFlipX;
    flipY = configFlipY;
}

export function initGamepad(data?: GamepadConfiguration) {
    // Clear map
    for (let idx = 0; idx < 16; idx++) {
        gamepadMap[idx] = undefined;
    }
    const map = data || DEFAULT_GAMEPAD;
    for (const entry of Object.entries(map)) {
        const key = entry[0] as ButtonType;
        const val = entry[1] as number | string;
        let mapVal;
        if (typeof val === 'string') {
            mapVal = val.charCodeAt(0);
        } else {
            mapVal = -val;
        }
        if (key in BUTTON) {
            gamepadMap[BUTTON[key]] = mapVal;
        } else {
            gamepadMap[parseInt(key, 10)] = mapVal;
        }
    }
}
