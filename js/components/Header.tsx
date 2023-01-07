import { h } from 'preact';

import styles from './css/Header.module.scss';

const README = 'https://github.com/whscullin/apple2js#readme';

/**
 * Header component properties.
 */
export interface HeaderProps {
    e: boolean;
}

/**
 * Header component, which consists of a badge and title.
 *
 * @returns Header component
 */
export const Header = ({ e }: HeaderProps) => {
    return (
        <div className={styles.header}>
            <a href={README} rel="noreferrer" target="_blank">
                <img src="img/badge.png" className={styles.badge} />
            </a>
            <div className={styles.subtitle}>
                An Apple {e ? '//e' : ']['} Emulator in JavaScript
            </div>
        </div>
    );
};
