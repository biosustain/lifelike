import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { ChartOptions, ChartType, ChartPoint } from 'chart.js';
import { EnrichWithGOTermsResult } from '../../../../services/enrichment-visualisation.service';

const mapTootipItem = func =>
  ({datasetIndex, index}, {datasets}) => {
    return func(datasets[datasetIndex].data[index]);
  };

const mapSingularOfTootipItems = func => {
  const wrappedFunc = mapTootipItem(func);
  return ([tootipItem], object) =>
    wrappedFunc(tootipItem, object);
};

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html'
})
export class ChartComponent implements OnChanges {
  public options: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
    xAxes: [
      {
        ticks: {
          suggestedMin: 0,
          stepSize: 1,
          // callback: value => value
        },
        gridLines: {
          drawOnChartArea: false
        },
        offset: true,
        type: 'logarithmic',
        scaleLabel: {
          display: true,
          labelString: '-log10 p-value'
        }
      }
    ],
    },
    plugins: {
      // Change options for ALL labels of THIS CHART
      datalabels: {
        display: false
      }
    },
    tooltips: {
      enabled: true,
      mode: 'y',
      intersect: false,
      callbacks: {
        title: mapSingularOfTootipItems(({gene}) => gene),
        label: mapTootipItem(d => `p-value: ${d['p-value']}`)
      }
    }
  };
  public chartType: ChartType = 'horizontalBar';
  legend = false;

  @Input() showMore: boolean;
  @Input() data: EnrichWithGOTermsResult[];

  slicedData: (EnrichWithGOTermsResult & ChartPoint)[];
  labels: string[];

  ngOnChanges() {
    const data = this.showMore ? this.data.slice(0, 50) : this.data.slice(0, 10);
    this.slicedData = data.map((d: any, i) => ({
      ...d,
      x: -Math.log10(d['p-value'])
    }));
    this.labels = data.map(({gene}) => gene);
  }
}
