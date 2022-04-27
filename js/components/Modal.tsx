import { h, FunctionalComponent } from 'preact';

const modalOverlayStyle = {
    position: 'fixed',
    left: '0',
    right: '0',
    top: '0',
    bottom: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.6)',
};

const modalStyle = {
    backgroundColor: '#c4c1a0',
    padding: '10px',
    maxHeight: '100vh',
    borderRadius: '4px',
    overflowY: 'auto',
    boxSizing: 'border-box',
};

const modalTitleStyle = {
    display: 'flex',
    fontSize: '14px',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#44372C',
    color: '#fff',
    padding: '5px 11px',
    border: '1px outset #66594E',
    borderRadius: '3px',
};

const modalContentStyle = {
    marginTop: '10px',
    marginBottom: '10px',
    lineHeight: '1.5',
    color: '#000'
};

const modalFooterStyle = {
    textAlign: 'right'
};

export interface ModalProps {
    show: boolean
    title: string
}

export const ModalOverlay: FunctionalComponent = ({ children }) => {
    return (
        <div style={modalOverlayStyle}>
            {children}
        </div>
    );
};

export const ModalContent: FunctionalComponent = ({ children }) => {
    return (
        <div style={modalContentStyle}>
            {children}
        </div>
    );
};

export const ModalFooter: FunctionalComponent = ({ children }) => {
    return (
        <div style={modalFooterStyle}>
            {children}
        </div>
    );
};

export const Modal: FunctionalComponent<ModalProps> = ({ show, title, children }) => {
    return (
        show ? (
            <ModalOverlay>
                <div style={modalStyle}>
                    <div style={modalTitleStyle}>
                        {title}
                    </div>
                    {children}
                </div>
            </ModalOverlay>
        ) : null
    );
};
