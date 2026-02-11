/** @jest-environment jsdom */
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { type Options, OptionsStore } from 'js/options';

import { BOOLEAN_OPTION, SELECT_OPTION, OptionHandler } from 'js/options';
import { OptionsModal } from 'js/ui/options_modal';

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
                        ],
                    },
                ],
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
                ],
            },
        ];
    },

    setOption: jest.fn(),
};

describe('OptionsModal', () => {
    let options: Options;
    let modal: OptionsModal;
    beforeEach(() => {
        options = new OptionsStore();
        options.addOptions(mockOptionHandler);
        modal = new OptionsModal(options);
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

        it('toggles booleans', async () => {
            modal.openModal();
            const toggle = screen.getByText('Option 3');
            await userEvent.click(toggle);
            expect(mockOptionHandler.setOption).toHaveBeenCalledWith(
                'option_3',
                false
            );
        });

        it('selects', async () => {
            modal.openModal();
            const combobox = screen.getByRole('combobox');
            await userEvent.selectOptions(combobox, 'select_2');

            expect(mockOptionHandler.setOption).toHaveBeenCalledWith(
                'option_2',
                'select_2'
            );
        });
    });

    describe('getOption', () => {
        beforeEach(() => {
            options = new OptionsStore();
            options.addOptions(mockOptionHandler);
            modal = new OptionsModal(options);
        });
        it('gets boolean', () => {
            expect(options.getOption('option_1')).toEqual(false);
            expect(options.getOption('option_3')).toEqual(true);
        });

        it('gets selector', () => {
            expect(options.getOption('option_2')).toEqual('select_1');
        });
    });

    describe('setOption', () => {
        it('sets boolean', () => {
            options.setOption('option_1', true);
            expect(mockOptionHandler.setOption).toHaveBeenCalledWith(
                'option_1',
                true
            );
        });

        it('sets selector', () => {
            options.setOption('option_2', 'select_2');
            expect(mockOptionHandler.setOption).toHaveBeenCalledWith(
                'option_2',
                'select_2'
            );
        });
    });
});
