import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { ChartOptions, ChartDataSets } from 'chart.js';
import { SingleDataSet } from 'ng2-charts';
import * as pluginDataLabels from 'chartjs-plugin-datalabels';

interface StatisticsDataResponse {
  [domain: string]: {
    [entity: string]: number
  };
}

const ENTITY_COLORS = [
  'rgba(12, 140, 170, 0.9)',
  'rgba(137, 196, 244, 0.9)',
  'rgba(78, 205, 196, 0.9)',
  'rgba(30, 130, 76, 0.9)',
  'rgba(51, 110, 123, 0.9)',
  'rgba(235, 149, 50, 0.9)',
  'rgba(226, 106, 106, 0.9)',
  'rgba(31, 58, 147, 0.9)',
  'rgba(244, 208, 63, 0.9)',
  'rgba(200, 247, 197, 0.9)',
  'rgba(44, 130, 201, 0.9)',
  'rgba(58, 83, 155, 0.9)',
  'rgba(242, 120, 75, 0.9)',
  'rgba(108, 122, 137, 0.9)',
  'rgba(144, 198, 149, 0.9)',
  'rgba(27, 163, 156, 0.9)',
  'rgba(192, 57, 43, 0.9)',
  'rgba(189, 195, 199, 0.9)',
  'rgba(150, 40, 27, 0.9)',
  'rgba(232, 232, 232, 0.9)'
];

const DOMAIN_COLORS = [
  'rgba(34, 167, 240, 0.9)',
  'rgba(236, 100, 75, 0.9)',
  'rgba(169, 109, 173, 0.9)',
  'rgba(38, 194, 129, 0.9)',
  'rgba(245, 230, 83, 0.9)',
  'rgba(242, 121, 53, 0.9)',
  'rgba(149, 165, 166, 0.9)',
  'rgba(174, 168, 211, 0.9)',
  'rgba(169, 109, 173, 0.9)',
  'rgba(83, 51, 237, 0.9)'
];

@Component({
  selector: 'app-kg-statistics',
  templateUrl: './kg-statistics.component.html',
  styleUrls: ['./kg-statistics.component.scss']
})
export class KgStatisticsComponent implements OnInit, OnDestroy {
  chartDataAllDomains: SingleDataSet;
  chartDataEntitiesByDomain: {
    [domain: string]: ChartDataSets[];
  };
  chartLabelsDomains: string[];
  chartLabelsEntitiesByDomain: {
    [domain: string]: string[];
  };
  barChartColorsByDomain: {
    [domain: string]: {
      backgroundColor: string[]
    }[];
  };
  pieChartColors: {
    backgroundColor: string[];
  }[];
  barChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      yAxes: [{
        ticks: {
          beginAtZero: true
        },
      }],
      xAxes: [{
        ticks: {
          fontSize: 14
        }
      }]
    },
    plugins: {
      datalabels: {
        anchor: 'end',
        offset: -4,
        align: 'end',
        font: {
          size: 14
        }
      }
    }
  };
  pieChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    legend: {
      labels: {
        fontSize: 16
      }
    },
    plugins: {
      datalabels: {
        font: {
          size: 14
        }
      }
    }
  };
  chartPlugins = [pluginDataLabels];
  subscription: Subscription;
  isLoading = true;
  hasFetchError = false;

  constructor(private http: HttpClient, private snackBar: MatSnackBar) { }

  ngOnInit() {
    this.subscription = this.http.get('/api/neo4j-entities/statistics').subscribe(
      (statisticsData: StatisticsDataResponse) => {
        this._getChartDataEntitiesByDomain(statisticsData);
        this._getChartDataAllDomains(statisticsData);
        this.isLoading = false;
      },
      err => {
        this.snackBar.open(`Error: could not fetch data.`, 'close', { duration: 10000 });
        this.isLoading = false;
        this.hasFetchError = true;
      }
    );
  }

  private _getChartDataEntitiesByDomain(statisticsData) {
    // assign color to each entity
    const entityToColor = {};
    for (const domainData of Object.values(statisticsData)) {
      Object.keys(domainData).forEach((entity, index) => {
        if (!entityToColor.hasOwnProperty(entity)) {
          entityToColor[entity] = ENTITY_COLORS[index];
        }
      });
    }

    this.chartDataEntitiesByDomain = {};
    this.chartLabelsEntitiesByDomain = {};
    this.barChartColorsByDomain = {};
    for (const [domain, domainData] of Object.entries(statisticsData)) {
      this.chartLabelsEntitiesByDomain[domain] = [];
      const dataset = { data: [], barPercentage: 0.9 };
      const colors = { backgroundColor: [] };
      for (const [entity, count] of Object.entries(domainData)) {
        dataset.data.push(count);
        colors.backgroundColor.push(entityToColor[entity]);
        this.chartLabelsEntitiesByDomain[domain].push(entity);
      }
      if (Object.keys(domainData).length === 1) {
        dataset.barPercentage = 0.12;
      }
      this.barChartColorsByDomain[domain] = [ colors ];
      this.chartDataEntitiesByDomain[domain] = [ dataset ];
    }
  }

  private _getChartDataAllDomains(statisticsData) {
    this.pieChartColors = [{ backgroundColor: DOMAIN_COLORS.map(color => color) }];
    this.chartDataAllDomains = [];
    this.chartLabelsDomains = [];
    for (const [domain, domainData] of Object.entries(statisticsData)) {
      this.chartDataAllDomains.push(Object.values(domainData).reduce((a, b) => a + b, 0));
      this.chartLabelsDomains.push(domain);
    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

}
