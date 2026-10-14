# 0008: Collapsible side navigation with topics registered per feature

- Status: accepted
- Date: 2026-10-14

## Context

The main navigation was one row in the top bar, next to Settings and the signed-in user. Every new
feature adds a topic, so the row was running out of space. The home owner wants:

- The topics in a menu on the left that can be collapsed, remembering that choice.
- Settings, the signed-in user and sign-out to stay in the top bar.

## Decision

- **Layout** (`src/app/layout/`): `App` composes a sticky `TopBar` (navigation toggle, app name,
  Settings, user, sign-out) and, once signed in and set up, a `SideNav` beside the routed page.
- **Topics registered per feature**: each feature exports a `NavTopic` (path, label, icon, read
  permission) from `<feature>/<feature>.nav.ts`. `app.config.ts` adds it with
  `provideNavTopic(...)`, a multi provider of the `NAV_TOPICS` token. The calls' order is the menu
  order. The `.nav.ts` files import nothing from the feature, so its routes stay lazy-loaded.
- **Permission-aware**: a topic is only listed for users holding its permission (ADR 0007). This hides
  links, not data; the API still enforces the permissions.
- **Icons**: inline SVG path data (24×24 outline, Heroicons, MIT) in the topic. There is no icon
  library dependency.
- **Wide screens (from Tailwind's `md`, 48rem)**: a sidebar that the top-bar toggle collapses to an
  icon rail. Collapsed links keep their label for screen readers (`sr-only`) and as a tooltip.
- **Narrow screens**: a drawer over the page with a backdrop. It is closed by default and closes
  after choosing a link, on Escape and on the backdrop.
- **Remembered per browser**: `NavPreferences` stores the collapsed state in `localStorage`
  (`domusmea.sideNavCollapsed`). Storage is only read in the browser and failures are ignored, so
  blocked storage just means the default (expanded). The drawer state is not stored.

## Consequences

- A new feature adds one `.nav.ts` file and one `provideNavTopic` line instead of editing the layout.
- The choice follows the device, not the account: a phone and a desktop can differ, and clearing site
  data resets it. Storing it per user would need a migration and an endpoint.
- All signed-in pages render in the browser (`RenderMode.Client`) and the side navigation needs a
  user, so the stored state applies on first paint without a hydration mismatch. A future prerendered
  or server-rendered signed-in page would first render expanded.
