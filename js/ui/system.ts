import { BOOLEAN_OPTION, SELECT_OPTION, OptionHandler } from './options_modal';
import Apple2IO from '../apple2io';

const SYSTEM_TYPE_APPLE2E = 'computer_type2e';
const SYSTEM_TYPE_APPLE2 = 'computer_type2';
const SYSTEM_CPU_ACCELERATED = 'accelerator_toggle';

export class System implements OptionHandler {
    constructor(private io: Apple2IO, private e: boolean) {}

    getOptions() {
        return [
            {
                name: 'Type',
                options: this.e ? [
                    {
                        name: SYSTEM_TYPE_APPLE2E,
                        label: ' *',
                        type: SELECT_OPTION,
                        defaultVal: 'apple2enh',
                        values: [
                            {
                                value: 'apple2enh',
                                name: 'Enhanced Apple //e'
                            },
                            {
                                value: 'apple2e',
                                name: 'Apple //e'
                            },
                            {
                                value: 'apple2rm',
                                name: 'Enhanced Apple //e (Reactive Micro)'
                            },
                            {
                                value: 'apple2ex',
                                name: 'Apple //e Extended Debugging'
                            },
                        ]
                    }
                ] : [
                    {
                        name: SYSTEM_TYPE_APPLE2,
                        label: ' *',
                        type: SELECT_OPTION,
                        defaultVal: 'apple2plus',
                        values: [
                            {
                                value: 'apple2plus',
                                name: 'Apple ][+'
                            },
                            {
                                value: 'apple2',
                                name: 'Autostart Apple ]['
                            },
                            {
                                value: 'apple213',
                                name: '13 Sector Apple ]['
                            },
                            {
                                value: 'original',
                                name: 'Apple ]['
                            },
                            {
                                value: 'apple2j',
                                name: 'Apple ][j+'
                            },
                            {
                                value: 'apple2lc',
                                name: 'Apple ][+ (lowercase font)'
                            },
                            {
                                value: 'apple2pig',
                                name: 'Apple ][+ (pig font)'
                            },
                        ]
                    },
                ]
            }, {
                name: 'CPU',
                options: [
                    {
                        name: SYSTEM_CPU_ACCELERATED,
                        label: 'Accelerated',
                        type: BOOLEAN_OPTION,
                        defaultVal: false,
                    },
                ]
            }
        ];
    }

    setOption(name: string, value: boolean ) {
        switch (name) {
            case SYSTEM_CPU_ACCELERATED:
                {
                    const kHz = value ? 4092 : 1023;
                    this.io.updateKHz(kHz);
                }
                break;
        }
    }
}
