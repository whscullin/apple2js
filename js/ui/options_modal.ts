import Prefs from '../prefs';
import MicroModal from 'micromodal';

export const BOOLEAN_OPTION = 'BOOLEAN_OPTION';
export const SELECT_OPTION = 'SELECT_OPTION';

export interface Option {
    name: string
    label: string
    type: string
    defaultVal: string | boolean
}

export interface BooleanOption extends Option {
    type: typeof BOOLEAN_OPTION
    defaultVal: boolean
}

export interface SelectOption extends Option {
    type: typeof SELECT_OPTION
    defaultVal: string
    values: Array<{name: string, value: string}>
}

export interface OptionSection {
    name: string
    options: Option[]
}

export interface OptionHandler {
    getOptions: () => OptionSection[]
    setOption: (name: string, value: string | boolean) => void
}

export class OptionsModal {
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

    openModal = () => {
        const content = document.querySelector('#options-modal-content');
        if (content) {
            content.innerHTML = '';
            for (const section of this.sections) {
                const { name, options } = section;

                // Section header
                const header = document.createElement('h3');
                header.textContent = name;
                content.appendChild(header);

                // Preferences
                const list = document.createElement('ul');
                for (const option of options) {
                    const { name, label, defaultVal, type } = option;
                    const onChange = (evt: InputEvent & { target: HTMLInputElement }) => {
                        const { target } = evt;
                        switch (type) {
                            case BOOLEAN_OPTION:
                                this.setOption(name, target.checked);
                                break;
                            default:
                                this.setOption(name, target.value);
                        }
                    };

                    const listItem = document.createElement('li');

                    let element: HTMLElement;
                    switch (type) {
                        case BOOLEAN_OPTION:
                            {
                                const inputElement = document.createElement('input');
                                const checked = this.prefs.readPref(name, String(defaultVal)) === 'true';
                                inputElement.setAttribute('type', 'checkbox');
                                inputElement.checked = checked;
                                element = inputElement;
                            }
                            break;
                        case SELECT_OPTION:
                            {
                                const selectOption = option as SelectOption;
                                const selectElement = document.createElement('select');
                                const selected = this.prefs.readPref(name, String(defaultVal));
                                for (const value of selectOption.values) {
                                    const optionElement = document.createElement('option');
                                    optionElement.value = value.value;
                                    optionElement.textContent = value.name;
                                    optionElement.selected = value.value === selected;
                                    selectElement.appendChild(optionElement);
                                }
                                element = selectElement;
                            }
                            break;
                        default:
                        {
                            const inputElement = document.createElement('input');
                            const value = this.prefs.readPref(name, String(defaultVal));
                            inputElement.value = value;
                            element = inputElement;
                        }
                    }
                    element.id = name;
                    element.addEventListener('change', onChange);
                    listItem.appendChild(element);
                    const labelElement = document.createElement('label');

                    labelElement.textContent = label;
                    labelElement.setAttribute('for', name);
                    listItem.appendChild(labelElement);

                    list.appendChild(listItem);
                }
                content.appendChild(list);
            }
            const reloadElement = document.createElement('i');
            reloadElement.textContent = '* Reload page to take effect';
            content.append(reloadElement);
        } else {
            console.error('Cannot find target div#options-modal-content');
        }
        MicroModal.show('options-modal');
    };
}
