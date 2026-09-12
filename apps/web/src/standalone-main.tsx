import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Preview from './standalone.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
