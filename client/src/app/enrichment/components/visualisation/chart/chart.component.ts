import {
  Component,
  Input,
  Output, EventEmitter
} from '@angular/core';
import {ChartOptions, ChartType} from 'chart.js';
import {SingleOrMultiDataSet} from "ng2-charts/lib/base-chart.directive";

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
            callback: (value, index) => index in this.data ? this.data[value]["Term"] : '',
          },
          offset: true,
          gridLines: {
            drawOnChartArea: false
          }
        }
      ]
    }
  };
  public chartType: ChartType = 'bubble';
  legend = false;
  public chartData: SingleOrMultiDataSet = [];

  @Input("data") set data(data: any[]) {
    this.chartData = data.slice(0, 10).map((d: any, i) => ({
      ...d,
      x: 1 / d["P-value"],
      y: i,
      r: 3.75 + 3.75 * d["Adjusted P-value"]
    }));
  }

  get data() {
    return this.chartData;
  }

  @Output("chartClick") chartClick: EventEmitter<any> = new EventEmitter();
  @Output("chartHover") chartHover: EventEmitter<any> = new EventEmitter();

}
