import { Component } from '@angular/core';
import { AccountSettings } from './account-settings/account-settings';
import { EmailSettingsPage } from './email-settings/email-settings';

/** The Settings page (`/settings`): reminder emails, then sign-in and security. */
@Component({
  selector: 'app-settings-page',
  imports: [EmailSettingsPage, AccountSettings],
  template: `
    <div class="mx-auto max-w-2xl">
      <h1 class="mb-4 text-2xl font-semibold">Settings</h1>
      <div class="grid gap-12">
        <app-email-settings />
        <app-account-settings />
      </div>
    </div>
  `,
})
export class SettingsPage {}
