import React, { type ReactNode } from 'react';
import cs from 'classnames';

import styles from './css/Inset.module.scss';

interface InsetProps extends React.HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
}

/**
 * Convenience component for a nice beveled border.
 *
 * @returns Inset component
 */
export const Inset = ({ children, className, ...props }: InsetProps) => (
    <div className={cs(className, styles.inset)} {...props}>
        {children}
    </div>
);
