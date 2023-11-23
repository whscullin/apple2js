import 'preact/debug';
import cs from 'classnames';
import { h } from 'preact';
import { Header } from './Header';
import { Apple2 } from './Apple2';
import { usePrefs } from './hooks/usePrefs';
import { SYSTEM_TYPE_APPLE2E } from '../ui/system';
import { SCREEN_GL } from '../ui/screen';
import { defaultSystem, systemTypes } from './util/systems';

import styles from './css/App.module.scss';
import componentStyles from './css/Components.module.scss';

/**
 * Top level application component, provides the parameters
 * needed by the Apple2 component to bootstrap itself.
 *
 * @returns Application component
 */
export const App = () => {
    const prefs = usePrefs();
    const systemType = prefs.readPref(SYSTEM_TYPE_APPLE2E, 'apple2enh');
    const gl = prefs.readPref(SCREEN_GL, 'true') === 'true';

    const system = {
        ...defaultSystem,
        ...(systemTypes[systemType] || {}),
    };

    return (
        <div className={cs(styles.container, componentStyles.components)}>
            <Header e={system.e} />
            <Apple2 gl={gl} {...system} />
        </div>
    );
};
