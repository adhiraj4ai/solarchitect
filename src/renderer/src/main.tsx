import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Self-hosted IBM Plex superfamily (bundled by Vite, served from 'self' — no
// network, CSP-clean). Sans carries the UI; Mono carries data and the editor.
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles/theme.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
