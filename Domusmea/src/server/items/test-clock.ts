import { Clock } from './item-repository';

/** Clock for tests with a settable date. */
export function testClock(
  today: string,
): Clock & { today: () => string; set(today: string): void } {
  let current = today;
  return {
    now: () => `${current}T08:00:00.000Z`,
    today: () => current,
    set(next) {
      current = next;
    },
  };
}
