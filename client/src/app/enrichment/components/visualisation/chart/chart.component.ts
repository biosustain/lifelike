import {
  Component,
  Input,
  Output, EventEmitter
} from '@angular/core';
import {ChartOptions, ChartType} from 'chart.js';
import { SingleOrMultiDataSet } from 'ng2-charts';

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
            // suggestedMin: -0.5,
            beginAtZero: true,
            stepSize: 1,
            callback: (value, index) => index in this.chartData ? this.chartData[index]['gene'] : '',
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
      callbacks: {
        label: (tooltipItem, data) => `p-value: ${Math.pow(10, -tooltipItem.xLabel)}`
      }
    }
  };
  public chartType: ChartType = 'bubble';
  legend = false;
  public chartData: SingleOrMultiDataSet = [];

  @Input('data') set data(data: any[]) {
    this.chartData = data.sort((a, b) => {
      return a['p-value'] - b['p-value'];
    }).map((d: any, i) => ({
      ...d,
      x: d['p-value'],
      y: i,
      // r: 3.75 + 3.75 * d["Adjusted P-value"]
    }));
  }

  get data() {
    return this.chartData;
  }

  @Output() chartClick: EventEmitter<any> = new EventEmitter();
  @Output() chartHover: EventEmitter<any> = new EventEmitter();

}
