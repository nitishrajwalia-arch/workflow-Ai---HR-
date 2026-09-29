/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * PART OF A MONTH — THE JOINER AND THE LEAVER.
 *
 * Both used to be paid for a whole month, and for the same reason: the
 * attendance machine has no rows for somebody before they are enrolled on it or
 * after they go, "no rows" reads as "not on the machine", and not on the
 * machine is paid the full month. Neither shows up on any screen as odd.
 */

import { describe, expect, it } from 'vitest';
import { monthWindow } from './pay.js';

const w = (over: Partial<Parameters<typeof monthWindow>[0]> = {}) =>
  monthWindow({ month: 'Jun 2026', monthDays: 30, ...over });

describe('how much of the month was theirs', () => {
  it('is the whole month for somebody who was there all of it', () => {
    const r = w({ joined: '15 Mar 2024' });
    expect(r.days).toBe(30);
    expect(r.whole).toBe(true);
    expect(r.why).toBe('');
  });

  it('starts on the day somebody joined', () => {
    const r = w({ joined: '16 Jun 2026' });
    expect(r.from).toBe(16);
    expect(r.to).toBe(30);
    expect(r.days).toBe(15);
    expect(r.why).toBe('joined on the 16');
  });

  it('ends on somebody’s last day', () => {
    const r = w({ joined: '01 Jan 2020', exited: '12 Jun 2026' });
    expect(r.from).toBe(1);
    expect(r.to).toBe(12);
    expect(r.days).toBe(12);
    expect(r.why).toBe('last day was the 12');
  });

  it('handles somebody who joined and left inside the same month', () => {
    const r = w({ joined: '05 Jun 2026', exited: '19 Jun 2026' });
    expect(r.days).toBe(15);
    expect(r.why).toBe('joined on the 5 and last day was the 19');
  });

  it('pays nothing to somebody who left before the month started', () => {
    const r = w({ joined: '01 Jan 2020', exited: '28 May 2026' });
    expect(r.days).toBe(0);
    expect(r.why).toBe('had already left');
  });

  it('pays nothing to somebody who had not joined yet', () => {
    const r = w({ joined: '04 Jul 2026' });
    expect(r.days).toBe(0);
    expect(r.why).toBe('had not joined yet');
  });

  it('is the whole month when the dates are in other months either side', () => {
    expect(w({ joined: '01 Feb 2020', exited: '12 Aug 2026' }).days).toBe(30);
  });

  it('counts the last day of the month as a whole month', () => {
    expect(w({ exited: '30 Jun 2026' }).whole).toBe(true);
    expect(w({ joined: '01 Jun 2026' }).whole).toBe(true);
  });

  it('counts a single day', () => {
    const r = w({ joined: '30 Jun 2026' });
    expect(r.days).toBe(1);
  });

  it('never docks anybody over a date it cannot read', () => {
    // The safe way round: a month heading or a date this cannot parse pays
    // what the run would have paid before any of this existed.
    expect(w({ month: 'nonsense' }).days).toBe(30);
    expect(w({ joined: 'sometime in June' }).days).toBe(30);
    expect(w({ joined: '', exited: null }).days).toBe(30);
  });

  it('works in February, which is the month that catches this out', () => {
    const feb = monthWindow({ month: 'Feb 2028', monthDays: 29, joined: '15 Feb 2028' });
    expect(feb.days).toBe(15);
    expect(feb.to).toBe(29);
    expect(monthWindow({ month: 'Feb 2026', monthDays: 28, exited: '28 Feb 2026' }).whole).toBe(true);
  });
});
