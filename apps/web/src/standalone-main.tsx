import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './standalone.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
