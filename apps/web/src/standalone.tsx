/**
 * The shareable preview: the real application, with the network removed.
 *
 * It renders the product exactly as delivered — the same providers, the same
 * screens — so every button can be pressed without an API behind it. You cannot
 * tell which buttons are dead by reading 13,000 lines, only by pressing them.
 *
 * There was a notice bar across the top of every screen here. It has been taken
 * out at the company's request. What it said has not gone away: this build has
 * no server, nothing saves, and Aadhaar, PAN, home addresses, full mobiles,
 * salaries and residents' names are ABSENT from the file rather than hidden in
 * it — `scripts/leak-check.py` proves that on every build. Two lines on the
 * sign-in screen say so once, where somebody opening the link for the first
 * time will read them.
 */
import App from './App.js';

export default function Standalone() {
  return <App />;
}
