import { h, JSX } from 'preact';

/**
 * Interface for ControlButton
 */

export interface ControlButtonProps {
    icon: string
    title: string
    onClick: JSX.MouseEventHandler<HTMLButtonElement>
}

/**
 * Simple button with an icon, tooltip text and a callback
 *
 * @param icon FontAwesome icon name
 * @param title Tooltip text
 * @param onClick Click callback
 * @returns Control Button component
 */

export const ControlButton = ({ icon, title, onClick }: ControlButtonProps) => (
    <button onClick={onClick} title={title}>
        <i class={`fas fa-${icon}`}></i>
    </button>
);
