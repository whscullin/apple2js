import { VideoModes } from '../videomodes';
import { BOOLEAN_OPTION, OptionHandler } from './options_modal';

export const SCREEN_MONO = 'mono_screen';
export const SCREEN_FULL_PAGE = 'full_page';
export const SCREEN_SCANLINE = 'show_scanlines';
export const SCREEN_GL = 'gl_canvas';

declare global {
    interface Document {
        webkitCancelFullScreen: () => void;
        webkitIsFullScreen: boolean;
        mozCancelFullScreen: () => void;
        mozIsFullScreen: boolean;
    }
    interface Element {
        webkitRequestFullScreen: (options?: any) => void;
        mozRequestFullScreen: () => void;
    }
}
export class Screen implements OptionHandler {
    constructor(private vm: VideoModes) {}

    enterFullScreen = (evt: KeyboardEvent) => {
        const elem = document.getElementById('screen')!;
        if (evt.shiftKey) { // Full window, but not full screen
            this.setFullPage(!document.body.classList.contains('full-page'));
        } else if (document.webkitCancelFullScreen) {
            if (document.webkitIsFullScreen) {
                document.webkitCancelFullScreen();
            } else {
                const allowKeyboardInput = (Element as any).ALLOW_KEYBOARD_INPUT;
                if (allowKeyboardInput) {
                    elem.webkitRequestFullScreen(allowKeyboardInput);
                } else {
                    elem.webkitRequestFullScreen();
                }
            }
        } else if (document.mozCancelFullScreen) {
            if (document.mozIsFullScreen) {
                document.mozCancelFullScreen();
            } else {
                elem.mozRequestFullScreen();
            }
        }
    };

    setFullPage(on: boolean) {
        if (on) {
            document.body.classList.add('full-page');
        } else {
            document.body.classList.remove('full-page');
        }
    }

    getOptions() {
        return [
            {
                name: 'Screen',
                options: [
                    {
                        name: SCREEN_MONO,
                        label: 'Mono Screen',
                        type: BOOLEAN_OPTION,
                        defaultVal: false,
                    },
                    {
                        name: SCREEN_SCANLINE,
                        label: 'Show Scanlines',
                        type: BOOLEAN_OPTION,
                        defaultVal: false,
                    },
                    {
                        name: SCREEN_FULL_PAGE,
                        label: 'Full Page',
                        type: BOOLEAN_OPTION,
                        defaultVal: false,
                    },
                    {
                        name: SCREEN_GL,
                        label: 'GL Renderer *',
                        type: BOOLEAN_OPTION,
                        defaultVal: true,
                    },
                ]
            }
        ];
    }

    setOption(name: string, value: boolean) {
        switch (name) {
            case SCREEN_MONO:
                this.vm.mono(value);
                break;
            case SCREEN_FULL_PAGE:
                this.setFullPage(value);
                break;
            case SCREEN_SCANLINE:
                this.vm.scanlines(value);
                break;
        }
    }
}
