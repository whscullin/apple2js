import type Mouse from '../cards/mouse';
import { enableMouseMode } from './joystick';

export class MouseUI {
    private mouse: Mouse;
    private canvas: HTMLCanvasElement;

    constructor(selector: string)  {
        this.canvas = document.querySelector<HTMLCanvasElement>(selector)!;

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
