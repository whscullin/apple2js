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
    values: Array<{ name: string; value: string }>;
}

export interface OptionSection {
    name: string;
    options: Option[];
}

export interface OptionHandler {
    getOptions: () => OptionSection[];
    setOption: (name: string, value: string | boolean) => void;
}

export interface Options {
    addOptions: (handler: OptionHandler) => void;
    getOption: (name: string) => string | boolean | undefined;
    setOption: (name: string, value: string | boolean) => void;
    getOptions: () => Record<string, Option>;
    getSections: () => OptionSection[];
}

export class OptionsStore extends EventTarget implements Options {
    private prefs: Prefs = new Prefs();
    private _options: Record<string, Option> = {};
    private _handlers: Record<string, OptionHandler> = {};
    private _sections: OptionSection[] = [];

    addOptions: (handler: OptionHandler) => void = (handler: OptionHandler) => {
        const sections = handler.getOptions();
        for (const section of sections) {
            const { options } = section;
            for (const option of options) {
                const { name } = option;
                this._handlers[name] = handler;
                this._options[name] = option;
                const value = this.getOption(name);
                if (value != null) {
                    handler.setOption(name, value);
                }
            }
            this._sections.push(section);
        }
    };

    getOption: (name: string) => string | boolean | undefined = (
        name: string
    ) => {
        const option = this._options[name];
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
    };

    setOption: (name: string, value: string | boolean) => void = (
        name: string,
        value: string | boolean
    ) => {
        if (name in this._options) {
            const handler = this._handlers[name];
            const option = this._options[name];
            this.prefs.writePref(name, String(value));
            switch (option.type) {
                case BOOLEAN_OPTION:
                    handler.setOption(name, Boolean(value));
                    break;
                default:
                    handler.setOption(name, String(value));
            }
            this.dispatchEvent(new Event('change'));
        }
    };

    getOptions: () => Record<string, Option> = () => {
        return { ...this._options };
    };

    getSections: () => OptionSection[] = () => {
        return this._sections;
    };
}
