/**
 * Standalone harness: the Procurement OS on its own seeded data, no server.
 *
 * This is the audit rig and the shareable demo, not the product. It renders the
 * legacy file exactly as delivered so every screen can be walked and every
 * button pressed without an API behind it — you cannot tell which buttons are
 * dead by reading 12,931 lines, only by pressing them.
 *
 * The notice is not decoration. Without it this build is indistinguishable from
 * the real one at a glance, and someone would reasonably conclude that the rules
 * are enforced and their edits are saved. Neither is true here.
 *
 * It closes, because after the first read it is just a bar taking up the top of
 * every screen. Closing leaves one small line rather than nothing: whoever you
 * forward this to has not read it yet, and a demo that looks exactly like the
 * real thing is how someone ends up trusting a number that was never saved.
 * The choice is remembered per browser.
 */
import { useState } from 'react';
// The legacy file is plain JS: `allowJs` imports it, `checkJs: false` leaves
// it untyped. Deliberate — see tsconfig.app.json.
import App from './legacy/MarbellaProcurementOS.jsx';

const KEY = 'marbella.demoNotice';

/** Reading storage throws outright in some privacy modes, so never assume. */
function remembered(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== 'closed';
  } catch {
    return true;
  }
}

function remember(open: boolean): void {
  try {
    window.localStorage.setItem(KEY, open ? 'open' : 'closed');
  } catch {
    /* A private window. The notice simply returns on the next load. */
  }
}

const NAVY = '#1D3157';
const SAND = '#F2E4C4';
const sans = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const shell: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 400,
  background: NAVY,
  color: SAND,
  borderBottom: '1px solid rgba(255,255,255,.14)',
};

const openRow: React.CSSProperties = {
  display: 'flex',
  gap: '10px 14px',
  alignItems: 'flex-start',
  padding: '9px 12px 9px 16px',
  font: `500 12.5px/1.45 ${sans}`,
};

const shutRow: React.CSSProperties = {
  display: 'flex',
  gap: '9px',
  alignItems: 'center',
  width: '100%',
  padding: '5px 12px 5px 16px',
  background: 'none',
  border: 'none',
  color: 'rgba(242,228,196,.72)',
  font: `500 11px/1 ${sans}`,
  cursor: 'pointer',
  textAlign: 'left',
};

const tag: React.CSSProperties = {
  font: `600 10px/1 ${sans}`,
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  background: '#C7A162',
  color: '#16233B',
  padding: '4px 8px',
  borderRadius: '3px',
  flex: 'none',
};

const smallTag: React.CSSProperties = {
  ...tag,
  font: `600 9px/1 ${sans}`,
  padding: '3px 6px',
  background: 'rgba(199,161,98,.9)',
};

const closeBtn: React.CSSProperties = {
  marginLeft: 'auto',
  flex: 'none',
  background: 'none',
  border: '1px solid rgba(255,255,255,.3)',
  borderRadius: '20px',
  color: SAND,
  font: `600 10px/1 ${sans}`,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  padding: '6px 11px',
  cursor: 'pointer',
};

export default function Standalone() {
  const [open, setOpen] = useState(remembered);

  const set = (next: boolean) => {
    setOpen(next);
    remember(next);
  };

  return (
    <>
      <div style={shell}>
        {open ? (
          <div style={openRow}>
            <span style={tag}>Demo</span>
            <span style={{ maxWidth: '104ch' }}>
              The interface, on seeded data, with <strong>no server behind it</strong>. Sign in with
              any of the nine Employee IDs and any password. Every screen works, but nothing is
              saved past a refresh and none of the rules are enforced — those live on the server,
              which this build does not have. Inside an embedded viewer,{' '}
              <strong>Download and Print do nothing</strong>: the viewer blocks both. They work when
              the app runs on your own machine.
            </span>
            <button
              type="button"
              style={closeBtn}
              onClick={() => set(false)}
              aria-label="Hide this notice"
            >
              Close ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            style={shutRow}
            onClick={() => set(true)}
            aria-label="Show what this demo build is"
          >
            <span style={smallTag}>Demo</span>
            <span>no server behind this build</span>
            <span style={{ marginLeft: 'auto', opacity: 0.75 }}>what this means ⌄</span>
          </button>
        )}
      </div>
      <App />
    </>
  );
}
