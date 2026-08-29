import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element to mount into.');

createRoot(root).render(
  // StrictMode double-invokes effects in development to surface the ones that
  // are not safe to run twice. Leave it on: an effect that breaks under it is
  // an effect that will break in production under a re-render you did not plan.
  <StrictMode>
    <App />
  </StrictMode>,
);
