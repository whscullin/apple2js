import { h } from 'preact';

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
        <div id="header">
            <a href={README} rel="noreferrer" target="_blank">
                <img src="img/badge.png" id="badge" />
            </a>
            <div id="subtitle">An Apple {e ? '//e' : ']['} Emulator in JavaScript</div>
        </div>
    );
};
