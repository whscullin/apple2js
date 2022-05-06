import { h, FunctionalComponent } from 'preact';

/**
 * Convenience component for a nice beveled border
 *
 * @returns Inset component
 */

export const Inset: FunctionalComponent = ({ children }) => (
    <div className="inset">
        {children}
    </div>
);
