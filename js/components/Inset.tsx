import { h, FunctionComponent } from 'preact';

export const Inset: FunctionComponent = ({ children }) => (
    <div className="inset">
        {children}
    </div>
);
