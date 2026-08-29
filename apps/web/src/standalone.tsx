/**
 * Standalone harness: the Procurement OS on its own seeded data, no server.
 *
 * This is the audit rig, not the product. It renders the file exactly as
 * delivered so every screen can be walked and every button pressed before any
 * of it is wired to an API — you cannot tell which buttons are dead by reading
 * 12,931 lines, only by pressing them.
 */
// @ts-expect-error - legacy JS, deliberately untyped
import App from './legacy/MarbellaProcurementOS.jsx';

export default App;
