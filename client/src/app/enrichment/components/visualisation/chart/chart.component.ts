import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ChartOptions, ChartType } from 'chart.js';

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
export class ChartComponent {
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
      yAxes: [
        {
          ticks: {
            reverse: true,
            // suggestedMin: -0.5,
            beginAtZero: true,
            stepSize: 1,
            callback: (value, index) =>
              index in this.chartData ? this.chartData[value].gene : '',
          },
          offset: true,
          gridLines: {
            drawOnChartArea: false
          }
        }
      ]
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
        title: mapSingularOfTootipItems(d => d['gene']),
        label: mapTootipItem(d => `p-value: ${d['p-value']}`)
      }
    }
  };
  public chartType: ChartType = 'bubble';
  legend = false;
  public chartData = [];

  @Input() set data(data) {
    this.chartData = data.map((d: any, i) => ({
      ...d,
      x: -Math.log10(d['p-value']),
      y: i,
      // r: 3.75 + 3.75 * Math.log10(d["geneNames"].length),
    }));
  }

  get data() {
    return this.chartData;
  }


  @Output() chartClick: EventEmitter<any> = new EventEmitter();
  @Output() chartHover: EventEmitter<any> = new EventEmitter();

}
