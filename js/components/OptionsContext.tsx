import { createContext } from 'preact';
import { OptionsModal } from '../ui/options_modal';

export const OptionsContext = createContext(new OptionsModal());
