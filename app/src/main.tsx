import '@fontsource-variable/figtree';
import '@fontsource-variable/jetbrains-mono';
import './styles/tokens.css';
import './styles/reset.css';
import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
