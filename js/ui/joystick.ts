import Apple2IO from '../apple2io';
import { BOOLEAN_OPTION, OptionHandler } from './options_modal';

const JOYSTICK_DISABLE = 'disable_mouse';
const JOYSTICK_FLIP_X_AXIS = 'flip_x';
const JOYSTICK_FLIP_Y_AXIS = 'flip_y';
const JOYSTICK_SWAP_AXIS = 'swap_x_y';

let mouseMode = false;

export function enableMouseMode(on: boolean) {
    mouseMode = on;
}

export class JoyStick implements OptionHandler {
    private disableMouseJoystick = false;
    private flipX = false;
    private flipY = false;
    private swapXY = false;
    private gamepad = false;

    constructor(private io: Apple2IO) {
        document.addEventListener('mousemove', this.mousemove);
        document.querySelectorAll('canvas').forEach((canvas) => {
            canvas.addEventListener('mousedown', (evt) => {
                if (!this.gamepad && !mouseMode) {
                    io.buttonDown(evt.which == 1 ? 0 : 1);
                }
                evt.preventDefault();
            });
            canvas.addEventListener('mouseup', (evt) => {
                if (!this.gamepad && !mouseMode) {
                    io.buttonUp(evt.which == 1 ? 0 : 1);
                }
            });
            canvas.addEventListener('contextmenu', (evt) => {
                evt.preventDefault();
            });
        });
        window.addEventListener('gamepadconnected', (e: GamepadEvent) => {
            this.gamepad = !!e.gamepad;
        });
    }

    getOptions() {
        return [
            {
                name: 'Joystick',
                options: [
                    {
                        name: JOYSTICK_DISABLE,
                        label: 'Disable Mouse Joystick',
                        type: BOOLEAN_OPTION,
                        defaultVal: false,
                    },
                    {
                        name: JOYSTICK_FLIP_X_AXIS,
                        label: 'Flip X-Axis',
                        type: BOOLEAN_OPTION,
                        defaultVal: false,
                    },
                    {
                        name: JOYSTICK_FLIP_Y_AXIS,
                        label: 'Flip Y-Axis',
                        type: BOOLEAN_OPTION,
                        defaultVal: false,
                    },
                    {
                        name: JOYSTICK_SWAP_AXIS,
                        label: 'Swap Axis',
                        type: BOOLEAN_OPTION,
                        defaultVal: false,
                    },
                ],
            },
        ];
    }

    setOption(name: string, _value: boolean) {
        switch (name) {
            case JOYSTICK_DISABLE:
                this.io.paddle(0, 0.5);
                this.io.paddle(1, 0.5);
                break;
            case JOYSTICK_FLIP_X_AXIS:
            case JOYSTICK_FLIP_Y_AXIS:
            case JOYSTICK_SWAP_AXIS:
        }
    }

    private mousemove = (evt: MouseEvent) => {
        if (this.gamepad || this.disableMouseJoystick || mouseMode) {
            return;
        }

        const s = document.querySelector<HTMLDivElement>('#screen')!;
        const offset = s.getBoundingClientRect();
        let x = (evt.pageX - offset.left) / s.clientWidth;
        let y = (evt.pageY - offset.top) / s.clientHeight;
        const z = x;

        if (this.swapXY) {
            x = y;
            y = z;
        }

        this.io.paddle(0, this.flipX ? 1 - x : x);
        this.io.paddle(1, this.flipY ? 1 - y : y);
    };
}
