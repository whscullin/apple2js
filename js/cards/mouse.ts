import { Card, byte, word, Restorable } from '../types';
import CPU6502, { CpuState } from '../cpu6502';
import { debug } from '../util';
import { rom } from '../roms/cards/mouse';

const CLAMP_MIN_LOW = 0x478;
const CLAMP_MAX_LOW = 0x4F8;
const CLAMP_MIN_HIGH = 0x578;
const CLAMP_MAX_HIGH = 0x5F8;

const X_LOW = 0x478;
const Y_LOW = 0x4F8;
const X_HIGH = 0x578;
const Y_HIGH = 0x5F8;
const STATUS = 0x778;
const MODE = 0x7F8;

const STATUS_DOWN = 0x80;
const STATUS_LAST = 0x40;
const STATUS_MOVED = 0x20;
const INT_SCREEN = 0x08;
const INT_PRESS = 0x04;
const INT_MOVE = 0x02;

const MODE_ON = 0x01;
const MODE_INT_MOVE = 0x02;
const MODE_INT_PRESS = 0x04;
const MODE_INT_VBL = 0x08;

/**
 * Firmware routine offset pointers
 */
const ENTRIES = {
    SET_MOUSE: 0x12,
    SERVE_MOUSE: 0x13,
    READ_MOUSE: 0x14,
    CLEAR_MOUSE: 0x15,
    POS_MOUSE: 0x16,
    CLAMP_MOUSE: 0x17,
    HOME_MOUSE: 0x18,
    INIT_MOUSE: 0x19
};

interface MouseState {
    clampXMin: word;
    clampYMin: word;
    clampXMax: word
    clampYMax: word;
    x: word;
    y: word;
    mode: byte;
    down: boolean;
    lastDown: boolean;
    lastX: word;
    lastY: word;
    serve: byte;
    shouldIntMove: boolean;
    shouldIntPress: boolean;
    slot: byte;
}

export default class Mouse implements Card, Restorable<MouseState> {
    /** Lowest mouse X */
    private clampXMin: word = 0;
    /** Lowest mouse Y */
    private clampYMin: word = 0;
    /** Highest mouse X */
    private clampXMax: word = 0x3FF;
    /** Highest mouse Y */
    private clampYMax: word = 0x3FF;
    /** Mouse X position */
    private x: word = 0;
    /** Mouse Y position */
    private y: word = 0;
    /** Mouse mode  */
    private mode: byte = 0;
    /** Mouse button down state */
    private down = false;
    /** Last mouse button down state */
    private lastDown = false;
    /** Last mouse Y Position */
    private lastX: word = 0;
    /** Last mouse X position  */
    private lastY: word = 0;
    /** Interrupt service flags */
    private serve: byte = 0;
    /** Move happened since last refresh */
    private shouldIntMove = false;
    /** Button press happened since last refresh */
    private shouldIntPress = false;
    /** Slot for screen hole indexing */
    private slot = 0;

    constructor(
        private cpu: CPU6502,
        private cbs: {
            setMouse: (mouse: Mouse) => void,
            mouseMode: (on: boolean) => void
        }
    ) {
        this.cbs.setMouse(this);
    }

    ioSwitch(_off: byte, _val?: byte) {
        return undefined;
    }

    read(_page: byte, off: byte) {
        let state = this.cpu.getState();

        const holeWrite = (addr: word, val: byte) => {
            this.cpu.write(addr >> 8, (addr & 0xff) + this.slot, val);
        };

        const holeRead = (addr: word) => {
            return this.cpu.read(addr >> 8, addr & 0xff);
        };

        const clearCarry = (state: CpuState) => {
            state.s &= 0xFE;
            return state;
        };

        if (this.cpu.getSync()) {
            switch (off) {
                case rom[ENTRIES.SET_MOUSE]:
                    {
                        this.mode = state.a;
                        this.cbs.mouseMode(!!(this.mode & MODE_ON));
                        state = clearCarry(state);
                        // debug(
                        //     'setMouse ',
                        //     (_mode & MODE_ON ? 'Mouse on ' : 'Mouse off '),
                        //     (_mode & MODE_INT_MOVE ? 'Move interrupt ' : '') +
                        //     (_mode & MODE_INT_PRESS ? 'Move press ' : '') +
                        //     (_mode & MODE_INT_VBL ? 'Move VBL ' : '')
                        // );
                    }
                    break;
                case rom[ENTRIES.SERVE_MOUSE]:
                    // debug('serveMouse');
                    holeWrite(STATUS, this.serve);
                    state = clearCarry(state);
                    this.serve = 0;
                    break;
                case rom[ENTRIES.READ_MOUSE]:
                    {
                        const moved = (this.lastX !== this.x) || (this.lastY !== this.y);
                        const status =
                            (this.down ? STATUS_DOWN : 0) |
                            (this.lastDown ? STATUS_LAST : 0) |
                            (moved ? STATUS_MOVED : 0);
                        const mouseXLow = this.x & 0xff;
                        const mouseYLow = this.y & 0xff;
                        const mouseXHigh = this.x >> 8;
                        const mouseYHigh = this.y >> 8;

                        // debug({ mouseXLow, mouseYLow, mouseXHigh, mouseYHigh });

                        holeWrite(X_LOW, mouseXLow);
                        holeWrite(Y_LOW, mouseYLow);
                        holeWrite(X_HIGH, mouseXHigh);
                        holeWrite(Y_HIGH, mouseYHigh);
                        holeWrite(STATUS, status);
                        holeWrite(MODE, this.mode);

                        this.lastDown = this.down;
                        this.lastX = this.x;
                        this.lastY = this.y;

                        state = clearCarry(state);
                    }
                    break;
                case rom[ENTRIES.CLEAR_MOUSE]:
                    debug('clearMouse');
                    state = clearCarry(state);
                    break;
                case rom[ENTRIES.POS_MOUSE]:
                    debug('posMouse');
                    state = clearCarry(state);
                    break;
                case rom[ENTRIES.CLAMP_MOUSE]:
                    {
                        const clampY = state.a;
                        if (clampY) {
                            this.clampYMin = holeRead(CLAMP_MIN_LOW) | (holeRead(CLAMP_MIN_HIGH) << 8);
                            this.clampYMax = holeRead(CLAMP_MAX_LOW) | (holeRead(CLAMP_MAX_HIGH) << 8);
                            debug('clampMouse Y', this.clampYMin, this.clampYMax);
                        } else {
                            this.clampXMin = holeRead(CLAMP_MIN_LOW) | (holeRead(CLAMP_MIN_HIGH) << 8);
                            this.clampXMax = holeRead(CLAMP_MAX_LOW) | (holeRead(CLAMP_MAX_HIGH) << 8);
                            debug('clampMouse X', this.clampXMin, this.clampXMax);
                        }
                        state = clearCarry(state);
                    }
                    break;
                case rom[ENTRIES.HOME_MOUSE]:
                    {
                        debug('homeMouse');
                        this.x = this.clampXMin;
                        this.y = this.clampYMin;
                        state = clearCarry(state);
                    }
                    break;
                case rom[ENTRIES.INIT_MOUSE]:
                    {
                        this.slot = state.y >> 4;
                        debug('initMouse slot', this.slot);
                        state = clearCarry(state);
                    }
                    break;
            }

            this.cpu.setState(state);
        }

        return rom[off];
    }

    write() {}

    /**
     * Triggers interrupts based on activity since the last tick
     */

    tick() {
        if (this.mode & MODE_INT_VBL) {
            this.serve |= INT_SCREEN;
        }
        if ((this.mode & MODE_INT_PRESS) && this.shouldIntPress) {
            this.serve |= INT_PRESS;
        }
        if ((this.mode & MODE_INT_MOVE) && this.shouldIntMove) {
            this.serve |= INT_MOVE;
        }
        if (this.serve) {
            this.cpu.irq();
        }
        this.shouldIntMove = false;
        this.shouldIntPress = false;
    }

    /**
     * Scales mouse position and clamps to min and max,and flags
     * potential mouse state change interrupt
     *
     * @param x Client mouse X position
     * @param y Client mouse Y position
     * @param w Client width
     * @param h Client height
     */

    setMouseXY(x: number, y: number, w: number, h: number) {
        const rangeX = this.clampXMax - this.clampXMin;
        const rangeY = this.clampYMax - this.clampYMin;
        this.x = (x * rangeX / w + this.clampXMin) & 0xffff;
        this.y = (y * rangeY / h + this.clampYMin) & 0xffff;
        this.shouldIntMove = true;
    }

    /**
     * Tracks mouse button state and flags potential
     * mouse state change interrupt
     *
     * @param down Mouse button down state
     */

    setMouseDown(down: boolean) {
        this.shouldIntPress = this.down !== down;
        this.down = down;
    }

    /**
     * Restores saved state
     *
     * @param state stored state
     */

    setState(state: MouseState) {
        this.clampXMin = state.clampXMin;
        this.clampYMin = state.clampYMin;
        this.clampXMax = state.clampXMax;
        this.clampYMax = state.clampYMax;
        this.x = state.x;
        this.y = state.y;
        this.mode = state.mode;
        this.down = state.down;
        this.lastDown = state.lastDown;
        this.lastX = state.lastX;
        this.lastY = state.lastY;
        this.serve = state.serve;
        this.shouldIntMove = state.shouldIntMove;
        this.shouldIntPress = state.shouldIntPress;
        this.slot = state.slot;
    }

    /**
     * Saves state for restoration
     *
     * @returns restorable state
     */

    getState(): MouseState {
        return {
            clampXMin: this.clampXMin,
            clampYMin: this.clampYMin,
            clampXMax: this.clampXMax,
            clampYMax: this.clampYMax,
            x: this.x,
            y: this.y,
            mode: this.mode,
            down: this.down,
            lastDown: this.lastDown,
            lastX: this.lastX,
            lastY: this.lastY,
            serve: this.serve,
            shouldIntMove: this.shouldIntMove,
            shouldIntPress: this.shouldIntPress,
            slot: this.slot
        };
    }
}
