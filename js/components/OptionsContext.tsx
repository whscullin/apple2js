import { createContext } from 'react';
import { Options } from '../options';

/**
 * Context for getting, setting and configuring options
 */
export const OptionsContext = createContext(new Options());
