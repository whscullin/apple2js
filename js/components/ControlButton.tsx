import { h, JSX } from 'preact';

/**
 * Interface for ControlButton.
 */
export interface ControlButtonProps {
    icon: string;
    title: string;
    disabled?: boolean;
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
export const ControlButton = ({ icon, title, onClick, ...props }: ControlButtonProps) => (
    <button onClick={onClick} title={title} {...props} >
        <i className={`fas fa-${icon}`}></i>
    </button>
);
