import { useState } from 'react';
import { Inset } from '../Inset';
import { Tab, Tabs } from '../Tabs';
import { Apple2 } from 'js/apple2';

import { Applesoft } from './Applesoft';
import { CPU } from './CPU';
import { Disks } from './Disks';
import { Memory } from './Memory';
import { VideoModes } from './VideoModes';

import styles from './css/Debugger.module.scss';

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
                <Tab>Disks</Tab>
                <Tab>Applesoft</Tab>
            </Tabs>
            <div className={styles.debugger}>
                {selected === 0 ? <CPU apple2={apple2} /> : null}
                {selected === 1 ? <VideoModes apple2={apple2} /> : null}
                {selected === 2 ? <Memory apple2={apple2} /> : null}
                {selected === 3 ? <Disks apple2={apple2} /> : null}
                {selected === 4 ? <Applesoft apple2={apple2} /> : null}
            </div>
        </Inset>
    );
};
