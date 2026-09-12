/**
 * The shareable preview: the real application, with the network removed.
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
// The REAL application. vite.config.demo.ts swaps lib/api for a fixed payload,
// so this is the product with the network removed — not a separate mock of it.
import App from './App.js';
import { DESKS, chooseDesk, currentDesk } from './preview/desk.js';

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

const deskBtn = (on: boolean): React.CSSProperties => ({
  background: on ? '#C7A162' : 'transparent',
  border: `1px solid ${on ? '#C7A162' : 'rgba(255,255,255,.32)'}`,
  color: on ? '#16233B' : SAND,
  font: `600 11px/1 ${sans}`,
  letterSpacing: '.04em',
  padding: '7px 12px',
  borderRadius: '20px',
  cursor: on ? 'default' : 'pointer',
  whiteSpace: 'nowrap',
});

function DeskSwitcher() {
  const now = currentDesk();
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <span
        style={{
          opacity: 0.7,
          font: `600 10px ${sans}`,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
        }}
      >
        Viewing as
      </span>
      {DESKS.map((d) => (
        <button
          key={d.key}
          type="button"
          style={deskBtn(d.key === now)}
          onClick={() => d.key !== now && chooseDesk(d.key)}
          title={d.who}
        >
          {d.label}
        </button>
      ))}
    </span>
  );
}

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
              Marbella's real structure — 126 people, 12 departments, four companies and 604 units —
              with <strong>no server behind it</strong>. Sign in with any Employee ID from the
              People screen and any password. Nothing saves. Aadhaar, PAN, home addresses, full
              mobiles, salaries and residents' names are <strong>absent from this build</strong>,
              not hidden in it.
            </span>
            <span
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                gap: 10,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <DeskSwitcher />
              <button
                type="button"
                style={closeBtn}
                onClick={() => set(false)}
                aria-label="Hide this notice"
              >
                Close ✕
              </button>
            </span>
          </div>
        ) : (
          <button
            type="button"
            style={shutRow}
            onClick={() => set(true)}
            aria-label="Show what this demo build is"
          >
            <span style={smallTag}>Demo</span>
            <span>
              Marbella's real structure — 126 people, 12 departments, four companies, 604 units —
              with <strong>no server behind it</strong>. Sign in with any Employee ID from the
              People screen and any password. Nothing saves, and Aadhaar, PAN, home addresses, full
              mobiles and resident names are <strong>absent from this build</strong>, not hidden in
              it.
            </span>
            <span style={{ marginLeft: 'auto', opacity: 0.75 }}>what this means ⌄</span>
          </button>
        )}
        {!open && (
          <div style={{ ...shutRow, cursor: 'default', paddingTop: 0, paddingBottom: 7 }}>
            <DeskSwitcher />
          </div>
        )}
      </div>
      <App />
    </>
  );
}
