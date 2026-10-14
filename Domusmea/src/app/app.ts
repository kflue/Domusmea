import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthApi } from './auth/auth-api';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthApi);
  private readonly router = inject(Router);

  protected readonly title = signal('Domusmea');

  /** The user once signed in and set up; the navigation is hidden before. */
  protected readonly user = computed(() => {
    const user = this.auth.user();
    return user && !user.setupRequired ? user : undefined;
  });

  protected async signOut(): Promise<void> {
    try {
      await this.auth.logout();
    } finally {
      await this.router.navigateByUrl('/login');
    }
  }
}
