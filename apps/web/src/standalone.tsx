/**
 * Standalone harness: the Procurement OS on its own seeded data, no server.
 *
 * This is the audit rig, not the product. It renders the file exactly as
 * delivered so every screen can be walked and every button pressed before any
 * of it is wired to an API — you cannot tell which buttons are dead by reading
 * 12,931 lines, only by pressing them.
 */
// The legacy file is plain JS: `allowJs` imports it, `checkJs: false` leaves
// it untyped. Deliberate — see tsconfig.app.json.
import App from './legacy/MarbellaProcurementOS.jsx';

export default App;
