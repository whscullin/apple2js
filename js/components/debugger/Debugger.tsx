import { h } from 'preact';
import { Inset } from '../Inset';
import { Tab, Tabs } from '../Tabs';
import { Apple2 } from 'js/apple2';
import { useState } from 'preact/hooks';
import { CPU } from './CPU';

import styles from './css/Debugger.module.css';
import { Applesoft } from './Applesoft';
import { Memory } from './Memory';
import { VideoModes } from './VideoModes';

interface DebuggerProps {
    apple2: Apple2 | undefined;
}

export const Debugger = ({ apple2 }: DebuggerProps) => {
    const [selected, setSelected] = useState(0);

    if (!apple2) {
        return null;
    }

    return (
        <Inset className={styles.inset}>
            <Tabs setSelected={setSelected}>
                <Tab>CPU</Tab>
                <Tab>Video</Tab>
                <Tab>Memory</Tab>
                <Tab>Applesoft</Tab>
            </Tabs>
            <div className={styles.debugger}>
                {selected === 0 ? <CPU apple2={apple2} /> : null}
                {selected === 1 ? <VideoModes apple2={apple2} /> : null}
                {selected === 2 ? <Memory apple2={apple2} /> : null}
                {selected === 3 ? <Applesoft apple2={apple2} /> : null}
            </div>
        </Inset>
    );
};
