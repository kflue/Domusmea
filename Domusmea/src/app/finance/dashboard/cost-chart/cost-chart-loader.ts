import { Chart } from '../../../shared/chart-js';
import { ChartColors } from '../../../shared/chart-support';
import { costChartConfig, CostChartFactory } from './cost-chart-config';

/** Draws a cost chart on `canvas` with Chart.js. Imported lazily through `COST_CHART_FACTORY`. */
export const createCostChart: CostChartFactory = (
  canvas: HTMLCanvasElement,
  colors: ChartColors,
) => {
  const chart = new Chart(canvas, costChartConfig({ periods: [], series: [] }, colors));
  return {
    update(data) {
      const config = costChartConfig(data, colors);
      chart.data = config.data;
      chart.options = config.options ?? {};
      chart.update();
    },
    showPeriod(index) {
      const active =
        index === undefined
          ? []
          : chart.data.datasets.flatMap((dataset, datasetIndex) =>
              dataset.data[index] === null ? [] : [{ datasetIndex, index }],
            );
      const first = active[0];
      const point = first && chart.getDatasetMeta(first.datasetIndex).data[index ?? 0];
      chart.setActiveElements(active);
      chart.tooltip?.setActiveElements(active, { x: point?.x ?? 0, y: point?.y ?? 0 });
      chart.update();
    },
    destroy() {
      chart.destroy();
    },
  };
};
