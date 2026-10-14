import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AccountInfo, ChangePasswordInput } from '../../shared/auth';
import { AuthApi } from '../auth/auth-api';

const ACCOUNT_URL = '/api/account';

/**
 * Access to `/api/account`. Provided by the account settings component, so the sign-ins are loaded
 * fresh on every visit and never before the user signed in.
 */
@Injectable()
export class AccountApi {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthApi);

  readonly account = httpResource<AccountInfo>(() => ACCOUNT_URL);

  /** Changes the password; other devices are signed out, this one stays signed in. */
  async changePassword(input: ChangePasswordInput): Promise<void> {
    await firstValueFrom(this.http.put<void>(`${ACCOUNT_URL}/password`, input));
  }

  /** Ends every session of the account, this one included. */
  async signOutEverywhere(): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${ACCOUNT_URL}/sign-out-everywhere`, null));
    this.auth.sessionEnded();
  }
}
