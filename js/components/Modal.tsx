import { h, ComponentChildren } from 'preact';
import cs from 'classnames';
import { createPortal } from 'preact/compat';
import { useCallback } from 'preact/hooks';
import { useHotKey } from './hooks/useHotKey';

import styles from './css/Modal.module.scss';
import componentStyles from './css/Components.module.scss';
import { ControlButton } from './ControlButton';

/**
 * ModalOverlay creates a semi-transparent overlay in which the
 * modal is centered.
 *
 * @returns ModalOverlay component
 */
export const ModalOverlay = ({ children }: { children: ComponentChildren }) => {
    return <div className={styles.modalOverlay}>{children}</div>;
};

/**
 * ModalContent provides a styled container for modal content
 *
 * @returns ModalContent component
 */
export const ModalContent = ({ children }: { children: ComponentChildren }) => {
    return <div className={styles.modalContent}>{children}</div>;
};

/**
 * ModalFooter provides a right-aligned container for modal buttons.
 *
 * @returns ModalFooter component
 */
export const ModalFooter = ({ children }: { children: ComponentChildren }) => {
    return (
        <div role="contentinfo" className={styles.modalFooter}>
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

    return <ControlButton onClick={doClose} title="Close" icon="xmark" />;
};

type OnCloseCallback = (closeBox?: boolean) => void;

/**
 * ModalHeader component properties
 */

export interface ModalHeaderProps {
    onClose?: OnCloseCallback;
    title: string;
    icon?: string;
}

/**
 * Header used internally for Modal component
 *
 * @param onClose Close callback
 * @param title Modal title
 * @returns ModalHeader component
 */
export const ModalHeader = ({ onClose, title, icon }: ModalHeaderProps) => {
    return (
        <div role="banner" className={styles.modalHeader}>
            <span className={styles.modalTitle}>
                {icon && <i className={`fa-solid fa-${icon}`} role="img" />}{' '}
                {title}
            </span>
            {onClose && <ModalCloseButton onClose={onClose} />}
        </div>
    );
};

/**
 * Modal component properties
 */
export interface ModalProps {
    onClose?: (closeBox?: boolean) => void;
    isOpen: boolean;
    title: string;
    children: ComponentChildren;
    icon?: string;
}

/**
 * Very simple modal component, provides a transparent overlay, title bar
 * with optional close box if onClose is provided. ModalContent and
 * ModalFooter components are provided for convenience but not required.
 *
 * @param isOpen true to show modal
 * @param title Modal title
 * @param onClose Close callback
 * @returns Modal component
 */
export const Modal = ({ isOpen, children, title, ...props }: ModalProps) => {
    return isOpen
        ? createPortal(
              <ModalOverlay>
                  <div
                      className={cs(styles.modal, componentStyles.components)}
                      role="dialog"
                  >
                      {title && <ModalHeader title={title} {...props} />}
                      {children}
                  </div>
              </ModalOverlay>,
              document.body
          )
        : null;
};
