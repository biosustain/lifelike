import { Component, OnInit, Input } from '@angular/core';

import * as Highcharts from 'highcharts';

import { SidenavClusterEntity, VisNode } from 'app/interfaces';
import { isNullOrUndefined } from 'util';

@Component({
    selector: 'app-sidenav-cluster-view',
    templateUrl: './sidenav-cluster-view.component.html',
    styleUrls: ['./sidenav-cluster-view.component.scss']
})
export class SidenavClusterViewComponent implements OnInit {
    @Input() set clusterEntity(clusterEntity: SidenavClusterEntity) {
        this.createChart(clusterEntity);
    }

    clusterDataChart: Highcharts.Chart;

    constructor() {}

    ngOnInit() {}

    // TODO: Noticed that sometimes there is a error occuring on line 52 ('name: node.displayName')
    // where 'node' is null. Not sure what the cause of this is.
    createChart(clusterEntity: SidenavClusterEntity) {
        this.clusterDataChart = Highcharts.chart({
            chart: {
                renderTo: 'container',
                type: 'bar',
                width: 640,
            },
            title: {
                text: 'Associations'
            },
            xAxis: {
                categories: clusterEntity.clusterGraphData.labels
            },
            yAxis: {
                title: {
                    text: 'Snippet Count'
                },
                max: 5, // TODO: This is a temporary solution until we figure out a way to normalize the data
                labels: {
                    formatter() {
                        const valAsString = this.value.toString();
                        return this.value >= 5 ? `+${valAsString}` : valAsString;
                    }
                },
            },
            series: clusterEntity.includes.map(node => {
                return {
                    type: 'bar',
                    name: node.displayName,
                    data: this.getDataForNode(node, clusterEntity),
                };
            })
        });
    }

    getDataForNode(node: VisNode, clusterEntity: SidenavClusterEntity) {
        const data = new Array<number>(clusterEntity.clusterGraphData.labels.length);
        const countDataForNode = clusterEntity.clusterGraphData.results[node.id];

        clusterEntity.clusterGraphData.labels.forEach((label, index) => {
            if (!isNullOrUndefined(countDataForNode[label])) {
                data[index] = countDataForNode[label];
            } else {
                data[index] = 0;
            }
        });
        return data;
    }
}
