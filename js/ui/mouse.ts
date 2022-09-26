import type Mouse from '../cards/mouse';
import { enableMouseMode } from './joystick';

type TouchEventWithTarget = TouchEvent & { target: HTMLCanvasElement };

export class MouseUI {
    private mouse: Mouse;

    constructor(private canvas: HTMLCanvasElement)  {
        const updateTouchXY = (event: TouchEventWithTarget) => {
            const { targetTouches, target } = event;
            if (targetTouches.length < 1) {
                return;
            }
            const rect = target.getBoundingClientRect();
            const leftPad = (rect.width - 560) / 2 + rect.left;
            const topPad = (rect.height - 384) / 2 + rect.top;
            const { clientX, clientY } = targetTouches[0];
            const xPos = clientX - leftPad;
            const yPos = clientY - topPad;
            this.mouse.setMouseXY(
                Math.max(Math.min(xPos, 559), 0),
                Math.max(Math.min(yPos, 383), 0),
                560,
                384,
            );
        };

        if ('ontouchstart' in window) {
            this.canvas.addEventListener(
                'touchmove',
                (event: TouchEventWithTarget) => {
                    updateTouchXY(event);
                }
            );

            this.canvas.addEventListener(
                'touchstart',
                (event: TouchEventWithTarget) => {
                    updateTouchXY(event);
                    // Make sure the mouse down is processed in a different
                    // pass as the move, so that a simple tap isn't treated like
                    // a drag.
                    setTimeout(() => this.mouse.setMouseDown(true), 100);
                }
            );

            this.canvas.addEventListener(
                'touchend',
                (event: TouchEventWithTarget) => {
                    updateTouchXY(event);
                    this.mouse.setMouseDown(false);
                }
            );

            this.canvas.addEventListener(
                'touchcancel',
                (event: TouchEventWithTarget) => {
                    updateTouchXY(event);
                    this.mouse.setMouseDown(false);
                }
            );
        } else {
            this.canvas.addEventListener(
                'mousemove',
                (event: MouseEvent & { target: HTMLCanvasElement} ) => {
                    const { offsetX, offsetY, target } = event;
                    this.mouse.setMouseXY(
                        offsetX,
                        offsetY,
                        target.clientWidth,
                        target.clientHeight
                    );
                }
            );

            this.canvas.addEventListener('mousedown', () => {
                this.mouse.setMouseDown(true);
            });

            this.canvas.addEventListener('mouseup', () => {
                this.mouse.setMouseDown(false);
            });
        }
    }

    setMouse = (mouse: Mouse) => {
        this.mouse = mouse;
    };

    mouseMode = (on: boolean) => {
        enableMouseMode(on);
        if (on) {
            this.canvas.classList.add('mouseMode');
        } else {
            this.canvas.classList.remove('mouseMode');
        }
    };
}
