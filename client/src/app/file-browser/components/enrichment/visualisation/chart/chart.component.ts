import {Component, OnInit, Input} from '@angular/core';
import {ChartDataSets, ChartOptions, ChartType} from 'chart.js';
import {Color} from 'ng2-charts';
import {SingleOrMultiDataSet} from "ng2-charts/lib/base-chart.directive";

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.scss']
})
export class ChartComponent implements OnInit {
  public chartOptions: ChartOptions = {
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
          gridLines:{
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
          gridLines:{
            drawOnChartArea: false
          }
        }
      ]
    }
  };
  public chartType: ChartType = 'bubble';
  public chartLegend = false;

  public chartData: SingleOrMultiDataSet = [];

  constructor() {
  }

  ngOnInit(): void {
  }

  @Input("data") set data(data: any[]) {
    this.chartData = data.slice(0,10).map((d: any, i) => ({
      ...d,
      x: 1/d["P-value"],
      y: i,
      r: 2.5+2.5*d["Adjusted P-value"]
    }));
  }

  get data() {
    return this.chartData;
  }

  // events
  public chartClicked({event, active}: { event: MouseEvent, active: {}[] }): void {
    console.log(event, active);
  }

  public chartHovered({event, active}: { event: MouseEvent, active: {}[] }): void {
    console.log(event, active);
  }
}
