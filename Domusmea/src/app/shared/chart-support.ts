/** Colours taken from the page so a chart follows light and dark mode. */
export interface ChartColors {
  text: string;
  grid: string;
}

/** Colours of the surrounding text, so axes and legend follow light and dark mode. */
export function pageColors(element: HTMLElement): ChartColors {
  const text = getComputedStyle(element).color || 'rgb(55, 65, 81)';
  const [red, green, blue] = text.match(/\d+/g) ?? ['55', '65', '81'];
  return { text, grid: `rgba(${red}, ${green}, ${blue}, 0.15)` };
}

/**
 * Keyboard stepping through a chart's periods: the period selected after pressing `key`, with
 * `undefined` to clear the selection (Escape); `null` if the key is not handled.
 */
export function stepPeriod(
  key: string,
  current: number | undefined,
  count: number,
): { index: number | undefined } | null {
  const last = count - 1;
  if (count === 0 && key !== 'Escape') {
    return null;
  }
  switch (key) {
    case 'ArrowRight':
      return { index: current === undefined ? 0 : Math.min(current + 1, last) };
    case 'ArrowLeft':
      return { index: current === undefined ? last : Math.max(current - 1, 0) };
    case 'Home':
      return { index: 0 };
    case 'End':
      return { index: last };
    case 'Escape':
      return { index: undefined };
    default:
      return null;
  }
}
