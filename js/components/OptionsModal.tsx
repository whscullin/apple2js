import React from 'react';
import { useCallback } from 'react';
import { Modal, ModalContent, ModalFooter } from './Modal';
import { useOptions } from './hooks/useOptions';
import {
    BOOLEAN_OPTION,
    SELECT_OPTION,
    BooleanOption,
    Option,
    OptionSection,
    SelectOption,
} from '../options';

import styles from './css/OptionsModal.module.scss';

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
const Boolean = ({ option, value, setValue }: BooleanProps) => {
    const { label, name } = option;
    const onChange = (event: React.ChangeEvent<HTMLInputElement>) =>
        setValue(name, event.currentTarget.checked);
    return (
        <li>
            <input type="checkbox" checked={value} onChange={onChange} />
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
const Select = ({ option, value, setValue }: SelectProps) => {
    const { label, name } = option;
    const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setValue(name, event.currentTarget.value);
    };

    const makeOption = (option: { name: string; value: string }) => (
        <option key={option.value} value={option.value}>
            {option.name}
        </option>
    );

    return (
        <li>
            <select onChange={onChange} value={value}>
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
    const { getSections, setOption, getOption } = useOptions();
    const setValue = (name: string, value: string | boolean) => {
        setOption(name, value);
    };

    const makeOption = (option: Option) => {
        const { name, type } = option;
        const value = getOption(name);
        switch (type) {
            case BOOLEAN_OPTION:
                return (
                    <Boolean
                        key={name}
                        option={option as BooleanOption}
                        value={value as boolean}
                        setValue={setValue}
                    />
                );
            case SELECT_OPTION:
                return (
                    <Select
                        key={name}
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
            <div key={section.name}>
                <h3>{section.name}</h3>
                <ul>{section.options.map(makeOption)}</ul>
            </div>
        );
    };

    const doClose = useCallback(() => onClose(), [onClose]);

    return (
        <Modal title="Options" isOpen={isOpen} onClose={onClose}>
            <ModalContent>
                <div className={styles.optionsModal}>
                    {getSections().map(makeSection)}
                </div>
                <i>* Reload page to take effect</i>
            </ModalContent>
            <ModalFooter>
                <button onClick={doClose}>Close</button>
            </ModalFooter>
        </Modal>
    );
};
