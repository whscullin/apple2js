import { h, ComponentChildren, JSX } from 'preact';
import cs from 'classnames';

import styles from './css/Inset.module.css';

interface InsetProps extends JSX.HTMLAttributes<HTMLDivElement> {
    children: ComponentChildren;
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
