import { h, JSX } from 'preact';
import cs from 'classnames';

import styles from './css/ControlButton.module.scss';

/**
 * Interface for ControlButton.
 */
export interface ControlButtonProps {
    icon: string;
    title: string;
    disabled?: boolean;
    active?: boolean;
    onClick: JSX.MouseEventHandler<HTMLButtonElement>;
}

/**
 * Simple button with an icon, tooltip text and a callback.
 *
 * @param icon FontAwesome icon name
 * @param title Tooltip text
 * @param onClick Click callback
 * @returns Control Button component
 */
export const ControlButton = ({ active, icon, title, onClick, ...props }: ControlButtonProps) => (
    <button className={styles.iconButton} onClick={onClick} title={title} {...props} >
        <i className={cs('fas', `fa-${icon}`, { [styles.active]: active })}></i>
    </button>
);
