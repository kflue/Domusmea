import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthApi } from './auth/auth-api';
import { SideNav } from './layout/side-nav';
import { TopBar } from './layout/top-bar';

/** The page layout: top bar, side navigation (once signed in) and the routed page. */
@Component({
  imports: [RouterOutlet, TopBar, SideNav],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  protected readonly user = inject(AuthApi).activeUser;
}
