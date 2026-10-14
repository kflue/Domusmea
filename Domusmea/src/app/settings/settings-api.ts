import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { EmailSettings, EmailSettingsInput } from '../../shared/email-settings';

const EMAIL_SETTINGS_URL = '/api/settings/email';

/** Access to `/api/settings/email`. `email` holds the saved settings; saving reloads them. */
@Service()
export class SettingsApi {
  private readonly http = inject(HttpClient);

  readonly email = httpResource<EmailSettings>(() => EMAIL_SETTINGS_URL);

  async saveEmail(input: EmailSettingsInput): Promise<EmailSettings> {
    const saved = await firstValueFrom(this.http.put<EmailSettings>(EMAIL_SETTINGS_URL, input));
    this.email.set(saved);
    return saved;
  }

  /** Sends a test email with the saved settings; rejects with the server's `TestEmailError`. */
  async sendTestEmail(): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${EMAIL_SETTINGS_URL}/test`, null));
  }
}
