import { h, FunctionalComponent } from 'preact';
import { useCallback } from 'preact/hooks';
import { useHotKey } from './hooks/useHotKey';

/**
 * Temporary JS styling while I figure out how I really want
 * to do it.
 */
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
    zIndex: 1,
};

const modalStyle = {
    backgroundColor: '#c4c1a0',
    padding: '10px',
    maxHeight: '100vh',
    borderRadius: '4px',
    overflowY: 'auto',
    boxSizing: 'border-box',
};

const modalHeaderStyle = {
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

const modalTitleStyle = {
    marginTop: 0,
    marginBottom: 0,
    fontWeight: 600,
    fontSize: '1.25rem',
    lineHeight: 1.25,
    color: '#fff',
    boxSizing: 'border-box',
};

const modalContentStyle = {
    marginTop: '10px',
    marginBottom: '10px',
    lineHeight: 1.5,
    color: '#000'
};

const modalFooterStyle = {
    textAlign: 'right'
};

/**
 * ModalOverlay creates a semi-transparent overlay in which the
 * modal is centered.
 *
 * @returns ModalOverlay component
 */
export const ModalOverlay: FunctionalComponent = ({ children }) => {
    return (
        <div style={modalOverlayStyle}>
            {children}
        </div>
    );
};

/**
 * ModalContent provides a styled container for modal content
 *
 * @returns ModalContent component
 */
export const ModalContent: FunctionalComponent = ({ children }) => {
    return (
        <div style={modalContentStyle}>
            {children}
        </div>
    );
};

/**
 * ModalFooter provides a right-aligned container for modal buttons.
 *
 * @returns ModalFooter component
 */
export const ModalFooter: FunctionalComponent = ({ children }) => {
    return (
        <div style={modalFooterStyle}>
            {children}
        </div>
    );
};

/**
 * ModalCloseButton component properties
 */
interface ModalCloseButtonProp {
    onClose: (closeBox?: boolean) => void;
}

/**
 * Renders a close button and registers a global Escape key
 * hook to trigger it.
 *
 * @param onClose Close callback
 * @returns ModalClose component
 */
export const ModalCloseButton = ({ onClose }: ModalCloseButtonProp) => {
    const doClose = useCallback(() => onClose(true), [onClose]);
    useHotKey('Escape', doClose);

    return (
        <button onClick={doClose} title="Close">
            {'\u2715'}
        </button>
    );
};

/**
 * ModalHeader component properties
 */
export interface ModalHeaderProps {
    onClose?: (closeBox?: boolean) => void;
    title: string;
}

/**
 * Header used internally for Modal component
 *
 * @param onClose Close callback
 * @param title Modal title
 * @returns ModalHeader component
 */
export const ModalHeader = ({ onClose, title }: ModalHeaderProps) => {
    return (
        <div style={modalHeaderStyle}>
            <span style={modalTitleStyle}>{title}</span>
            {onClose && <ModalCloseButton onClose={onClose} />}
        </div>
    );
};

/**
 * Modal component properties
 */
export interface ModalProps {
    onClose?: (closeBox?: boolean) => void
    isOpen: boolean
    title: string
}

/**
 * Very simple modal component, provides a transparent overlay, title bar
 * with optional close box if onClose is provided. ModalContent and
 * ModalFooter components are provided for convenience but not required.
 *
 * @param isOpen true to show modal
 * @param title Modal title
 * @onClose Close callback
 * @returns Modal component
 */
export const Modal: FunctionalComponent<ModalProps> = ({
    isOpen,
    title,
    children,
    onClose
}) => {
    return (
        isOpen ? (
            <ModalOverlay>
                <div style={modalStyle}>
                    {title && <ModalHeader onClose={onClose} title={title} />}
                    {children}
                </div>
            </ModalOverlay>
        ) : null
    );
};
