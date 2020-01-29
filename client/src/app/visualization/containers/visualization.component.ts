import { Component, OnInit } from '@angular/core';
import { VisualizationService } from '../services/visualization.service';
import { Neo4jResults } from '../../interfaces';

@Component({
    selector: 'app-visualization',
    templateUrl: './visualization.component.html',
    styleUrls: ['./visualization.component.scss'],
})
export class VisualizationComponent implements OnInit {

    networkGraphData: Neo4jResults;
    networkGraphConfig: object;

    constructor(private visService: VisualizationService) {}

    ngOnInit() {
        this.visService.getAllOrganisms().subscribe((result: Neo4jResults) => {
            this.networkGraphData = result;
        });
        this.networkGraphConfig = this.visualizationConfig();
    }

    visualizationConfig() {
        const config = {
            physics: {
                enabled: true,
            }
        };
        return config;
    }
}
