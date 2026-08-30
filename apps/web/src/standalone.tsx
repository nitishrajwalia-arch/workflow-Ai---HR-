/**
 * Standalone harness: the Procurement OS on its own seeded data, no server.
 *
 * This is the audit rig and the shareable demo, not the product. It renders the
 * legacy file exactly as delivered so every screen can be walked and every
 * button pressed without an API behind it — you cannot tell which buttons are
 * dead by reading 12,931 lines, only by pressing them.
 *
 * The banner is not decoration. Without it this build is indistinguishable from
 * the real one at a glance, and someone would reasonably conclude that the rules
 * are enforced and their edits are saved. Neither is true here: there is no
 * server to enforce anything and nothing survives a refresh.
 */
// The legacy file is plain JS: `allowJs` imports it, `checkJs: false` leaves
// it untyped. Deliberate — see tsconfig.app.json.
import App from './legacy/MarbellaProcurementOS.jsx';

const bar: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 400,
  background: '#1D3157',
  color: '#F2E4C4',
  font: '500 12.5px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  padding: '9px 16px',
  display: 'flex',
  gap: '8px 14px',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  borderBottom: '1px solid rgba(255,255,255,.14)',
};

const tag: React.CSSProperties = {
  font: '600 10px/1 ui-sans-serif, system-ui, sans-serif',
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  background: '#C7A162',
  color: '#16233B',
  padding: '4px 8px',
  borderRadius: '3px',
  flex: 'none',
};

export default function Standalone() {
  return (
    <>
      <div style={bar}>
        <span style={tag}>Demo</span>
        <span>
          The interface, on seeded data, with <strong>no server behind it</strong>. Sign in with any
          of the nine Employee IDs and any password. Every screen works, but nothing is saved past a
          refresh and none of the rules are enforced — those live on the server, which this build
          does not have. If you are reading this inside an embedded viewer,{' '}
          <strong>Download and Print do nothing here</strong>: the viewer blocks both. They work
          when the app is running on your own machine.
        </span>
      </div>
      <App />
    </>
  );
}
