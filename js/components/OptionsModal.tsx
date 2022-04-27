import { h } from 'preact';
import { useContext } from 'preact/hooks';
import { Modal } from './Modal';
import { OptionsContext } from './OptionsContext';
import {
    BooleanOption,
    Option,
    OptionsModal as Options,
    OptionSection
} from '../ui/options_modal';

export interface OptionsModalProps {
    show: boolean
}

const Boolean = (options: Options, option: BooleanOption) => {
    return (
        <input
            type="checkbox"
            checked={options.getOption(option.name)}
        />
    )
};

export const OptionsModal = ({ show }: OptionsModalProps) => {
    const options = useContext(OptionsContext);
    const sections = options.getSections()

    const makeOption = (option: Option) => {

    }

    const makeSection = (section: OptionSection) => {
        return (
            <div>
                <div>{section.name}</div>
                {section.options.map(makeOption)}
            </div>
        );
    };

    return (
        <Modal title="Options" show={show}>
            {sections.map(makeSection)}
        </Modal>
    );
};
