import Prefs from './prefs';

export const BOOLEAN_OPTION = 'BOOLEAN_OPTION';
export const SELECT_OPTION = 'SELECT_OPTION';

export interface Option {
    name: string;
    label: string;
    type: string;
    defaultVal: string | boolean;
}

export interface BooleanOption extends Option {
    type: typeof BOOLEAN_OPTION;
    defaultVal: boolean;
}

export interface SelectOption extends Option {
    type: typeof SELECT_OPTION;
    defaultVal: string;
    values: Array<{name: string; value: string}>;
}

export interface OptionSection {
    name: string;
    options: Option[];
}

export interface OptionHandler {
    getOptions: () => OptionSection[];
    setOption: (name: string, value: string | boolean) => void;
}

export class Options {
    private prefs: Prefs = new Prefs();
    private options: Record<string, Option> = {};
    private handlers: Record<string, OptionHandler> = {};
    private sections: OptionSection[] = [];

    addOptions(handler: OptionHandler) {
        const sections = handler.getOptions();
        for (const section of sections) {
            const { options } = section;
            for (const option of options) {
                const { name } = option;
                this.handlers[name] = handler;
                this.options[name] = option;
                const value = this.getOption(name);
                if (value != null) {
                    handler.setOption(name, value);
                }
            }
            this.sections.push(section);
        }
    }

    getOption(name: string): string | boolean | undefined {
        const option = this.options[name];
        if (option) {
            const { name, defaultVal, type } = option;
            const stringVal = String(defaultVal);
            const prefVal = this.prefs.readPref(name, stringVal);
            switch (type) {
                case BOOLEAN_OPTION:
                    return prefVal === 'true';
                default:
                    return prefVal;
            }
        }
    }

    setOption(name: string, value: string | boolean) {
        if (name in this.options) {
            const handler = this.handlers[name];
            const option = this.options[name];
            this.prefs.writePref(name, String(value));
            switch (option.type) {
                case BOOLEAN_OPTION:
                    handler.setOption(name, Boolean(value));
                    break;
                default:
                    handler.setOption(name, String(value));
            }
        }
    }

    getOptions() {
        return this.options;
    }

    getSections() {
        return this.sections;
    }
}
