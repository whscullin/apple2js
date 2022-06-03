import { h, ComponentChildren } from 'preact';

import styles from './css/Inset.module.css';

/**
 * Convenience component for a nice beveled border.
 *
 * @returns Inset component
 */
export const Inset = ({ children }: { children: ComponentChildren }) => (
    <div className={styles.inset}>
        {children}
    </div>
);
