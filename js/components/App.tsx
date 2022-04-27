import 'preact/debug';
import { h, Fragment } from 'preact';
import { Header } from './Header';
import { Apple2 } from './Apple2';

export const App = () => {
    return (
        <>
            <Header />
            <Apple2
                e
                enhanced
                gl
                rom="apple2enh"
                characterRom="apple2enh_char"
            />
        </>
    );
};
