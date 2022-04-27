import { h } from 'preact';

export const Header = () => {
    return (
        <div id="header">
            <a href="https://github.com/whscullin/apple2js#readme" target="_blank">
                <img src="img/badge.png" id="badge" />
            </a>
            <div id="subtitle">An Apple ][ Emulator in JavaScript</div>
        </div>
    );
};
