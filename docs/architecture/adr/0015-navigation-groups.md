# 0015: Side navigation grouped into capex and opex

- Status: accepted
- Date: 2026-10-15
- Extends: [0008](0008-side-navigation.md)

## Context

The side navigation (ADR 0008) was a flat list in registration order. The finance dashboard splits
costs into opex, running costs per month, and capex, investments per year (ADR 0013, 0014). The
home owner wants the menu to show that split: Finance on top, then the topics that hold investments
and the ones that hold running costs, each under a subtitle.

## Decision

- **Optional group per topic**: `NavTopic` gets `group?: NavGroup` (`'capex' | 'opex'`). Subtitles
  live in `NAV_GROUP_LABELS` in `src/app/layout/nav-topics.ts`.
- **Order**: ungrouped topics first, without a subtitle; then one section per group, in the order its
  first topic is registered with `provideNavTopic`. The menu is: Finance · **Capex**: Appliances &
  building parts, Repairs & investments · **Opex**: Energy & utilities.
- **Permission-aware**: a group whose topics the user may not see is left out, subtitle included.
- **Markup**: each section is its own `<ul>`; a grouped one is labelled by its `<h2>` subtitle
  (`aria-labelledby`), so screen readers announce the group.
- **Icon rail**: collapsed, the subtitle text becomes `sr-only` and only its top border shows, as a
  divider between the groups. The drawer shows the same groups as the sidebar.

## Consequences

- A feature joins a group with one property in its `.nav.ts`; the layout stays untouched.
- Groups are fixed headings: they cannot be collapsed or reordered by the user.
- A topic that fits neither group, such as a future overview, stays ungrouped at the top.
