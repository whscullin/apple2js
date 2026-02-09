import { createRoot } from 'react-dom/client';
import { App } from './components/App';

if (navigator.standalone) {
    document.body.classList.add('standalone');
}

createRoot(document.getElementById('app')!).render(<App />);
