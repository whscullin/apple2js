/** @jest-environment jsdom */
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

import {
    BOOLEAN_OPTION,
    SELECT_OPTION,
    OptionHandler,
    OptionsModal
} from 'js/ui/options_modal';

jest.mock('micromodal');

const mockOptionHandler: OptionHandler = {
    getOptions() {
        return [
            {
                name: 'Section 1',
                options: [
                    {
                        name: 'option_1',
                        label: 'Option 1',
                        type: BOOLEAN_OPTION,
                        defaultVal: false,
                    },
                    {
                        name: 'option_2',
                        label: 'Option 2',
                        type: SELECT_OPTION,
                        defaultVal: 'select_1',
                        values: [
                            {
                                name: 'Select 1',
                                value: 'select_1',
                            },
                            {
                                name: 'Select 2',
                                value: 'select_2',
                            },
                        ]
                    }
                ]
            },
            {
                name: 'Section 2',
                options: [
                    {
                        name: 'option_3',
                        label: 'Option 3',
                        type: BOOLEAN_OPTION,
                        defaultVal: true,
                    },
                ]
            }
        ];
    },

    setOption: jest.fn()
};

describe('OptionsModal', () => {
    let modal: OptionsModal;
    beforeEach(() => {
        modal = new OptionsModal();
        modal.addOptions(mockOptionHandler);
    });
    afterEach(() => {
        localStorage.clear();
    });

    describe('openModal', () => {
        let content: HTMLDivElement;

        beforeEach(() => {
            content = document.createElement('div');
            content.id = 'options-modal-content';
            document.body.appendChild(content);
        });

        afterEach(() => {
            jest.resetAllMocks();
            content.remove();
        });

        it('renders', () => {
            modal.openModal();
            expect(content).toMatchSnapshot();
        });

        it('toggles booleans', () => {
            modal.openModal();
            const toggle = screen.getByText('Option 3');
            userEvent.click(toggle);
            expect(mockOptionHandler.setOption)
                .toHaveBeenCalledWith('option_3', false);
        });

        it('selects', () => {
            modal.openModal();
            const combobox = screen.getByRole('combobox');
            userEvent.selectOptions(combobox, 'select_2');

            expect(mockOptionHandler.setOption)
                .toHaveBeenCalledWith('option_2', 'select_2');
        });
    });

    describe('getOption', () => {
        beforeEach(() => {
            modal = new OptionsModal();
            modal.addOptions(mockOptionHandler);
        });
        it('gets boolean', () => {
            expect(modal.getOption('option_1'))
                .toEqual(false);
            expect(modal.getOption('option_3'))
                .toEqual(true);
        });

        it('gets selector', () => {
            expect(modal.getOption('option_2'))
                .toEqual('select_1');
        });
    });

    describe('setOption', () => {
        it('sets boolean', () => {
            modal.setOption('option_1', true);
            expect(mockOptionHandler.setOption)
                .toHaveBeenCalledWith('option_1', true);
        });

        it('sets selector', () => {
            modal.setOption('option_2', 'select_2');
            expect(mockOptionHandler.setOption)
                .toHaveBeenCalledWith('option_2', 'select_2');
        });
    });
});
