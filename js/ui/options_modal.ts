import MicroModal from 'micromodal';
import {
    BOOLEAN_OPTION,
    SELECT_OPTION,
    Options,
    SelectOption
} from '../options';

export class OptionsModal {
    constructor(private options: Options) {}

    openModal = () => {
        const content = document.querySelector('#options-modal-content');
        if (content) {
            content.innerHTML = '';
            for (const section of this.options.getSections()) {
                const { name, options } = section;

                // Section header
                const header = document.createElement('h3');
                header.textContent = name;
                content.appendChild(header);

                // Preferences
                const list = document.createElement('ul');
                for (const option of options) {
                    const { name, label, type } = option;
                    const onChange = (evt: InputEvent & { target: HTMLInputElement }) => {
                        const { target } = evt;
                        switch (type) {
                            case BOOLEAN_OPTION:
                                this.options.setOption(name, target.checked);
                                break;
                            default:
                                this.options.setOption(name, target.value);
                        }
                    };

                    const listItem = document.createElement('li');

                    let element: HTMLElement;
                    switch (type) {
                        case BOOLEAN_OPTION:
                            {
                                const inputElement = document.createElement('input');
                                const checked = this.options.getOption(name) as boolean;
                                inputElement.setAttribute('type', 'checkbox');
                                inputElement.checked = checked;
                                element = inputElement;
                            }
                            break;
                        case SELECT_OPTION:
                            {
                                const selectOption = option as SelectOption;
                                const selectElement = document.createElement('select');
                                const selected = this.options.getOption(name) as string;
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
                            const value = this.options.getOption(name) as string;
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
