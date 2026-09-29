import './lib/migrate';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/cairo';
import '@fontsource/lalezar/arabic-400.css';
import '@fontsource/lalezar/latin-400.css';
// Subtitle fonts: only downloaded when the viewer picks them.
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';
import '@fontsource-variable/noto-naskh-arabic';
import './styles/app.css';
import './styles/player.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline shell + faster repeat launches (installed PWA).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}
