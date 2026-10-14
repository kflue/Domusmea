import { InjectionToken, Provider } from '@angular/core';
import { Permission } from '../../shared/auth';

/** A topic in the side navigation, registered by its feature (ADR 0008). */
export interface NavTopic {
  /** Route path of the feature's start page. */
  path: string;
  label: string;
  /** SVG path data for a 24×24 outline icon (stroke, no fill), shown alone when collapsed. */
  icon: string;
  /** Users without this permission do not see the topic. */
  permission: Permission;
}

/** All registered topics, in the order of their `provideNavTopic` calls. */
export const NAV_TOPICS = new InjectionToken<readonly NavTopic[]>('NAV_TOPICS');

/** Adds a feature's topic to the side navigation; called in `app.config.ts`. */
export function provideNavTopic(topic: NavTopic): Provider {
  return { provide: NAV_TOPICS, useValue: topic, multi: true };
}
