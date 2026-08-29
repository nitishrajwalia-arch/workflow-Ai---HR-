import { describe, expect, it } from 'vitest';
import {
  emailCheck,
  employeeIdCheck,
  gstinCheck,
  imeiCheck,
  luhnOK,
  normDate,
  normalisePhone,
  panCheck,
  parseDisplayDate,
  phoneCheck,
  reraCheck,
  toDisplayDate,
  toDisplayStamp,
} from './validation.js';

describe('emailCheck', () => {
  it('accepts an ordinary address', () => {
    expect(emailCheck('simran.kaur88@gmail.com').level).toBe('ok');
  });

  it('is silent on an empty optional field and blocks an empty required one', () => {
    expect(emailCheck('').level).toBe('none');
    expect(emailCheck('', { required: true }).level).toBe('error');
  });

  it.each([
    ['a b@x.com', 'space'],
    ['nodomain', 'no @'],
    ['a@@b.com', 'two @'],
    ['@x.com', 'nothing before @'],
    ['a@', 'nothing after @'],
    ['.a@x.com', 'leading dot'],
    ['a.@x.com', 'trailing dot'],
    ['a..b@x.com', 'double dot'],
    ['a@bcom', 'no dot in domain'],
    ['a@-b.com', 'domain starts with hyphen'],
    ['a@b.c', 'tld too short'],
    ['a@b.c0m', 'digits in tld'],
  ])('rejects %s (%s)', (value) => {
    expect(emailCheck(value).level).toBe('error');
  });

  it('gives a distinct message for each distinct failure', () => {
    const msgs = [
      'a b@x.com',
      'nodomain',
      'a@@b.com',
      '@x.com',
      'a@',
      '.a@x.com',
      'a..b@x.com',
      'a@bcom',
      'a@-b.com',
      'a@b.c',
      'a@b.c0m',
    ].map((v) => emailCheck(v).msg);
    expect(new Set(msgs).size).toBe(msgs.length);
  });

  it('suggests a fix for a common typo instead of just refusing', () => {
    const r = emailCheck('someone@gmial.com');
    expect(r.level).toBe('warn');
    expect(r.fix).toBe('someone@gmail.com');
  });

  it('refuses the company address in the personal field', () => {
    // The company account is closed the day they leave, so it is useless here.
    const r = emailCheck('simran@marbellagroup.in', { mustBePersonal: true });
    expect(r.level).toBe('error');
    expect(r.msg).toMatch(/company account is closed/);
  });

  it('allows the company address when that is what is wanted', () => {
    expect(emailCheck('simran@marbellagroup.in', { mustBeCompany: true }).level).toBe('ok');
    expect(emailCheck('simran@gmail.com', { mustBeCompany: true }).level).toBe('warn');
  });
});

describe('phoneCheck', () => {
  it('accepts ten digits starting 6-9, with or without a country code', () => {
    expect(phoneCheck('9814000021').level).toBe('ok');
    expect(phoneCheck('+91 98140 00021').level).toBe('ok');
  });

  it('rejects a number that does not start 6-9', () => {
    expect(phoneCheck('1234567890').level).toBe('error');
  });

  it('rejects a short number and says how short', () => {
    expect(phoneCheck('98140').msg).toMatch(/Only 5 digits/);
  });

  it('normalises to the ten digits we store', () => {
    expect(normalisePhone('+91 98140-00021')).toBe('9814000021');
  });
});

describe('imeiCheck / luhnOK', () => {
  it('accepts the seeded IMEIs, which are genuinely valid', () => {
    for (const imei of [
      '352094081234566',
      '354876101234560',
      '351756051234567',
      '353012111234561',
    ]) {
      expect(luhnOK(imei)).toBe(true);
    }
  });

  it('rejects a fifteen-digit number whose check digit is wrong', () => {
    const r = imeiCheck('352094081234567');
    expect(r.level).toBe('error');
    expect(r.msg).toMatch(/check digit/);
  });

  it('says how many digits it got when the length is wrong', () => {
    expect(imeiCheck('12345').msg).toMatch(/5 digits/);
  });

  it('treats an em-dash placeholder as no IMEI, not a bad one', () => {
    expect(imeiCheck('—').level).toBe('none');
  });
});

describe('gstinCheck', () => {
  it('blocks a value that is not GSTIN-shaped', () => {
    expect(gstinCheck('NOTAGSTIN').level).toBe('error');
  });

  it('reads the state and PAN out of the number', () => {
    const r = gstinCheck('03AAEFD4921K1Z9');
    expect(r.state).toBe('Punjab');
    expect(r.pan).toBe('AAEFD4921K');
  });

  it('WARNS, never blocks, when the check character disagrees', () => {
    // Every seeded GSTIN is a placeholder, so this is the path they take.
    // A real registration must never be refused on arithmetic we cannot confirm.
    const r = gstinCheck('03AAEFD4921K1Z9');
    expect(r.level).not.toBe('error');
    expect(r.level).toBe('warn');
    expect(r.msg).toMatch(/GST portal/);
  });

  it('warns on an unrecognised state code', () => {
    expect(gstinCheck('99AAEFD4921K1Z9').msg).toMatch(/State code 99/);
  });
});

describe('panCheck', () => {
  it('accepts a well-shaped PAN and rejects a malformed one', () => {
    expect(panCheck('AAEFD4921K').level).toBe('ok');
    expect(panCheck('AAEFD4921').level).toBe('error');
  });
});

describe('reraCheck', () => {
  it('says nothing unless the project claims to be registered', () => {
    expect(reraCheck('', 'applied').level).toBe('none');
    expect(reraCheck('', 'notyet').level).toBe('none');
  });

  it('blocks "received" with no number', () => {
    expect(reraCheck('', 'received').level).toBe('error');
  });

  it('accepts the Punjab pattern and only warns on an unfamiliar one', () => {
    expect(reraCheck('PBRERA-SAS79-PR0421', 'received').level).toBe('ok');
    expect(reraCheck('SOMETHING-ELSE', 'received').level).toBe('warn');
  });
});

describe('normDate', () => {
  it.each([
    ['05/06/2020', '05 Jun 2020'],
    ['5-6-2020', '05 Jun 2020'],
    ['5.6.20', '05 Jun 2020'],
    ['2020-06-05', '05 Jun 2020'],
    ['05 Jun 2020', '05 Jun 2020'],
  ])('reads %s as %s', (input, want) => {
    expect(normDate(input)).toBe(want);
  });

  it('is day-first, because that is how the subcontinent writes a date', () => {
    expect(normDate('01/02/2020')).toBe('01 Feb 2020');
  });

  it('hands back anything it does not recognise rather than inventing a date', () => {
    expect(normDate('sometime last year')).toBe('sometime last year');
  });

  it('round-trips through the display format', () => {
    const d = parseDisplayDate('05 Jun 2020');
    expect(d).not.toBeNull();
    expect(toDisplayDate(d!)).toBe('05 Jun 2020');
  });

  it('renders the ledger stamp format the seeded data already uses', () => {
    expect(toDisplayStamp(new Date(Date.UTC(2026, 6, 18, 10, 12)))).toBe('18 Jul 2026 · 10:12');
  });

  it('refuses to parse a display date that is not one', () => {
    expect(parseDisplayDate('05 Xyz 2020')).toBeNull();
    expect(parseDisplayDate('2020-06-05')).toBeNull();
  });
});

describe('employeeIdCheck', () => {
  it('accepts the house format and rejects anything else', () => {
    expect(employeeIdCheck('MB-PUR-0012').level).toBe('ok');
    expect(employeeIdCheck('MB-HR-0001').level).toBe('ok');
    expect(employeeIdCheck('PUR-0012').level).toBe('error');
    expect(employeeIdCheck('MB-PUR-12').level).toBe('error');
  });
});
