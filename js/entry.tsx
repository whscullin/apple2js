import { h, render } from 'preact';
import { App } from './components/App';

if (navigator.standalone) {
    document.body.classList.add('standalone');
}

render(<App />, document.getElementById('app')!);
