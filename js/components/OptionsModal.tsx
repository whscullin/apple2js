import { h, Fragment, JSX } from 'preact';
import { useCallback, useContext } from 'preact/hooks';
import { Modal, ModalContent, ModalFooter } from './Modal';
import { OptionsContext } from './OptionsContext';
import {
    BOOLEAN_OPTION,
    SELECT_OPTION,
    BooleanOption,
    Option,
    OptionSection,
    SelectOption,
} from '../options';

/**
 * Boolean property interface
 */
interface BooleanProps {
    option: BooleanOption;
    value: boolean;
    setValue: (name: string, value: boolean) => void;
}

/**
 *
 * @param option Boolean option
 * @param value Current value
 * @param setValue Value setter
 * @returns Boolean component
 */
const Boolean = ({ option, value, setValue } : BooleanProps) => {
    const { label, name } = option;
    const onChange = useCallback(
        (event: JSX.TargetedMouseEvent<HTMLInputElement>) =>
            setValue(name, event.currentTarget.checked)
        , [name, setValue]
    );

    return (
        <li>
            <input
                type="checkbox"
                checked={value}
                onChange={onChange}
            />
            <label>{label}</label>
        </li>
    );
};

/**
 * Select property interface
 */
interface SelectProps {
    option: SelectOption;
    value: string;
    setValue: (name: string, value: string) => void;
}

/**
 * Select component that provides a dropdown to choose between
 * options.
 *
 * @param option Select option
 * @param value Current value
 * @param setValue Value setter
 * @returns Select component
 */
const Select = ({ option, value, setValue } : SelectProps) => {
    const { label, name } = option;
    const onChange = useCallback(
        (event: JSX.TargetedMouseEvent<HTMLSelectElement>) => {
            setValue(name, event.currentTarget.value);
        },
        [name, setValue]
    );

    const makeOption = (option: { name: string; value: string }) => (
        <option selected={option.value === value} value={option.value}>
            {option.name}
        </option>
    );

    return (
        <li>
            <select onChange={onChange}>
                {option.values.map(makeOption)}
            </select>
            <label>{label}</label>
        </li>
    );
};

/**
 * OptionsModal properties
 */
export interface OptionsModalProps {
    isOpen: boolean;
    onClose: (closeBox?: boolean) => void;
}

/**
 * Modal to allow editing of various component provided
 * options, like screen and cpu type
 *
 * @param Modal params
 * @returns OptionsModal component
 */
export const OptionsModal = ({ isOpen, onClose }: OptionsModalProps) => {
    const options = useContext(OptionsContext);
    const sections = options.getSections();
    const setValue = useCallback(( name: string, value: string | boolean ) => {
        options.setOption(name, value);
    }, [options]);

    const makeOption = (option: Option) => {
        const { name, type } = option;
        const value = options.getOption(name);
        switch (type) {
            case BOOLEAN_OPTION:
                return (
                    <Boolean
                        option={option as BooleanOption}
                        value={value as boolean}
                        setValue={setValue}
                    />
                );
            case SELECT_OPTION:
                return (
                    <Select
                        option={option as SelectOption}
                        value={value as string}
                        setValue={setValue}
                    />
                );
            default:
                break;
        }
    };

    const makeSection = (section: OptionSection) => {
        return (
            <>
                <h3>{section.name}</h3>
                <ul>
                    {section.options.map(makeOption)}
                </ul>
            </>
        );
    };

    const doClose = useCallback(() => onClose(), [onClose]);

    return (
        <Modal title="Options" isOpen={isOpen} onClose={onClose}>
            <ModalContent>
                <div id="options-modal">
                    {sections.map(makeSection)}
                </div>
                <i>* Reload page to take effect</i>
            </ModalContent>
            <ModalFooter>
                <button onClick={doClose}>Close</button>
            </ModalFooter>
        </Modal>
    );
};
