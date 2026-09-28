import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Preview from './standalone.js';
// The preview is the same app, so it gets the same shell stylesheet the
// served build gets. Without this line the touch minimums and the safe-area
// insets exist only on the server-backed build, and the single-file preview
// — the copy people actually open on a phone — goes without them.
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
