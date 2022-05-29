import { h, ComponentChildren } from 'preact';

/**
 * Convenience component for a nice beveled border.
 *
 * @returns Inset component
 */
export const Inset = ({ children }: { children: ComponentChildren }) => (
    <div className="inset">
        {children}
    </div>
);
