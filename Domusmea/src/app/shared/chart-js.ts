import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

// The one place that loads Chart.js (ADR 0011, ADR 0013). Only chart loaders import this file, and
// only through `import()`, so Chart.js is a single lazy, browser-only chunk. Register only the parts
// the app's charts use.
Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
);

export { Chart };
