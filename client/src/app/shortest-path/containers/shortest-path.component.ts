import { Component, OnInit } from '@angular/core';

import { ShortestPathService } from '../services/shortest-path.service';

export interface GraphData {
  nodes: any;
  edges: any;
}

@Component({
  selector: 'app-shortest-path',
  templateUrl: './shortest-path.component.html',
  styleUrls: ['./shortest-path.component.scss']
})
export class ShortestPathComponent implements OnInit {

  displayType: string;
  graphData: GraphData;

  constructor(
    public shortestPathService: ShortestPathService,
  ) {}

  ngOnInit() { }

  changeDisplayType(type: string) {
    this.displayType = type;
  }

  loadNewQuery(query: number) {
    this.graphData = null;
    switch (query) {
      // 3-hydroxyisobutyric Acid to pykF Using ChEBI
      case 0: {
        this.shortestPathService.threeHydroxyisobutyricAcidToPykfChebi().subscribe((result) => {
          this.graphData = {
            nodes: result.nodes,
            edges: result.edges,
          };
        });
        break;
      }
      // 3-hydroxyisobutyric Acid to pykF using BioCyc
      case 1: {
        this.shortestPathService.threeHydroxyisobutyricAcidToPykfBiocyc().subscribe((result) => {
          this.graphData = {
            nodes: result.nodes,
            edges: result.edges,
          };
        });
        break;
      }
      // icd to rhsE
      case 2: {
        this.shortestPathService.icdToRhse().subscribe((result) => {
          this.graphData = {
            nodes: result.nodes,
            edges: result.edges,
          };
        });
        break;
      }
      // SIRT5 to NFE2L2 Using Literature Data
      case 3: {
        this.shortestPathService.sirt5ToNfe2l2Literature().subscribe((result) => {
          this.graphData = {
            nodes: result.nodes,
            edges: result.edges,
          };
        });
        break;
      }
      // CTNNB1 to Diarrhea Using Literature Data
      case 4: {
        this.shortestPathService.ctnnb1ToDiarrheaLiterature().subscribe((result) => {
          this.graphData = {
            nodes: result.nodes,
            edges: result.edges,
          };
        });
        break;
      }
      // Two pathways using BioCyc
      case 5: {
        this.shortestPathService.twoPathwaysBiocyc().subscribe((result) => {
          this.graphData = {
            nodes: result.nodes,
            edges: result.edges,
          };
        });
        break;
      }
    }
  }
}
