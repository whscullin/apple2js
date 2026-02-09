import { type ReactNode } from 'react';
import { useCallback, useState } from 'react';
import cs from 'classnames';

import styles from './css/Tabs.module.scss';

export interface TabProps {
    children: ReactNode;
}

export const Tab = ({ children }: TabProps) => {
    return <div>{children}</div>;
};

interface TabWrapperProps {
    children: ReactNode;
    onClick: () => void;
    selected: boolean;
}

const TabWrapper = ({ children, onClick, selected }: TabWrapperProps) => {
    return (
        <div
            onClick={onClick}
            className={cs(styles.tab, { [styles.selected]: selected })}
        >
            {children}
        </div>
    );
};

export interface TabsProps {
    children: ReactNode;
    setSelected: (selected: number) => void;
}

export const Tabs = ({ children, setSelected }: TabsProps) => {
    const [innerSelected, setInnerSelected] = useState(0);

    const innerSetSelected = useCallback(
        (idx: number) => {
            setSelected(idx);
            setInnerSelected(idx);
        },
        [setSelected]
    );

    if (!Array.isArray(children)) {
        return null;
    }

    return (
        <div className={styles.tabs}>
            {children.map((child, idx) => (
                <TabWrapper
                    key={idx}
                    onClick={() => innerSetSelected(idx)}
                    selected={idx === innerSelected}
                >
                    {child}
                </TabWrapper>
            ))}
        </div>
    );
};
