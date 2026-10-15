import { Chart } from '../../shared/chart-js';
import { ChartColors } from '../../shared/chart-support';
import { chartConfig, ChartFactory, mainDatasetIndex } from './utility-chart-config';

/** Draws a utility chart on `canvas` with Chart.js. Imported lazily through `CHART_FACTORY`. */
export const createChart: ChartFactory = (canvas: HTMLCanvasElement, colors: ChartColors) => {
  const chart = new Chart(canvas, chartConfig([], 'kWh', colors));
  let main = 0;
  return {
    update(periods, unit, compare) {
      main = mainDatasetIndex(compare);
      const config = chartConfig(periods, unit, colors, compare);
      chart.data = config.data;
      chart.options = config.options ?? {};
      chart.update();
    },
    showPeriod(index) {
      const active = index === undefined ? [] : [{ datasetIndex: main, index }];
      const point = index === undefined ? undefined : chart.getDatasetMeta(main).data[index];
      chart.setActiveElements(active);
      chart.tooltip?.setActiveElements(active, { x: point?.x ?? 0, y: point?.y ?? 0 });
      chart.update();
    },
    destroy() {
      chart.destroy();
    },
  };
};
