import { VideoModes } from '../videomodes';
import { BOOLEAN_OPTION, OptionHandler } from './options_modal';

const SCREEN_MONO = 'mono_screen';
const SCREEN_SCANLINE = 'show_scanlines';
const SCREEN_GL = 'gl_canvas';

export class Screen implements OptionHandler {
    constructor(private vm: VideoModes) {}

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
            case SCREEN_SCANLINE:
                this.vm.scanlines(value);
                break;
        }
    }
}
