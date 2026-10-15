import { NavTopic } from '../layout/nav-topics';

export const utilitiesNavTopic: NavTopic = {
  path: '/utilities',
  label: 'Energy & utilities',
  // Heroicons "bolt" outline (MIT).
  icon: 'm3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z',
  permission: 'finance:read',
};
