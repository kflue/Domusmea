import { InjectionToken, Provider } from '@angular/core';
import { Permission } from '../../shared/auth';

/** A heading in the side navigation that groups cost-related topics (ADR 0015). */
export type NavGroup = 'capex' | 'opex';

/** Subtitles of the groups; ungrouped topics come first, without one. */
export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  capex: 'Capex',
  opex: 'Opex',
};

/** A topic in the side navigation, registered by its feature (ADR 0008). */
export interface NavTopic {
  /** Route path of the feature's start page. */
  path: string;
  label: string;
  /** SVG path data for a 24×24 outline icon (stroke, no fill), shown alone when collapsed. */
  icon: string;
  /** Users without this permission do not see the topic. */
  permission: Permission;
  /** Group heading to list the topic under; none for top-level topics such as Finance. */
  group?: NavGroup;
}

/** All registered topics, in the order of their `provideNavTopic` calls. */
export const NAV_TOPICS = new InjectionToken<readonly NavTopic[]>('NAV_TOPICS');

/** Adds a feature's topic to the side navigation; called in `app.config.ts`. */
export function provideNavTopic(topic: NavTopic): Provider {
  return { provide: NAV_TOPICS, useValue: topic, multi: true };
}
