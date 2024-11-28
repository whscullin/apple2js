import { h, render } from 'preact';
import { App } from './components/App';

if (navigator.standalone) {
    document.body.classList.add('standalone');
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
render(<App />, document.getElementById('app')!);
