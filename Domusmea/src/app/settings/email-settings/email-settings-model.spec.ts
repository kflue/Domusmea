import { EmailSettings } from '../../../shared/email-settings';
import {
  dropsSavedPassword,
  parsePort,
  parseRecipients,
  toEmailSettingsInput,
  toFormModel,
} from './email-settings-model';

const saved: EmailSettings = {
  host: 'smtp.example.ch',
  port: 587,
  security: 'starttls',
  username: 'home@example.ch',
  passwordSet: true,
  from: 'home@example.ch',
  recipients: ['anna@example.ch', 'ben@example.ch'],
  canStorePassword: true,
};

describe('email settings form model', () => {
  it('parses recipients separated by line breaks, commas or semicolons', () => {
    expect(parseRecipients(' a@x.ch,\nb@x.ch ; c@x.ch\n\n')).toEqual([
      'a@x.ch',
      'b@x.ch',
      'c@x.ch',
    ]);
    expect(parseRecipients('  ')).toEqual([]);
  });

  it('accepts ports from 1 to 65535 only', () => {
    expect(parsePort(' 465 ')).toBe(465);
    for (const invalid of ['', '0', '65536', '58.7', '-1', 'abc']) {
      expect(parsePort(invalid)).toBeUndefined();
    }
  });

  it('round-trips saved settings and keeps the password unless one is entered or removed', () => {
    const form = toFormModel(saved);
    expect(form.recipients).toBe('anna@example.ch\nben@example.ch');
    expect(toEmailSettingsInput(form)).toEqual({
      host: 'smtp.example.ch',
      port: 587,
      security: 'starttls',
      username: 'home@example.ch',
      password: undefined,
      from: 'home@example.ch',
      recipients: ['anna@example.ch', 'ben@example.ch'],
    });
    expect(toEmailSettingsInput({ ...form, password: ' new ' }).password).toBe(' new ');
    expect(toEmailSettingsInput({ ...form, password: 'new', removePassword: true }).password).toBe(
      null,
    );
  });

  it('detects when a changed server drops the saved password', () => {
    const form = toFormModel(saved);
    expect(dropsSavedPassword(saved, form)).toBe(false);
    expect(dropsSavedPassword(saved, { ...form, recipients: 'x@y.ch' })).toBe(false);
    expect(dropsSavedPassword(saved, { ...form, host: 'smtp.other.ch' })).toBe(true);
    expect(dropsSavedPassword(saved, { ...form, security: 'none' })).toBe(true);
    expect(dropsSavedPassword(saved, { ...form, host: 'smtp.other.ch', password: 'pw' })).toBe(
      false,
    );
    expect(dropsSavedPassword({ ...saved, passwordSet: false }, { ...form, port: '25' })).toBe(
      false,
    );
  });
});
