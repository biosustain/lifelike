import { Component, OnInit, OnDestroy, Input } from '@angular/core';

import { TableHeader } from './generic-table.component';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { DirectoryContent } from 'app/interfaces/projects.interface';
import { Subscription, zip } from 'rxjs';
import { Worksheet, WorksheetViewerService, NCBINode, NCBIWrapper, EnrichmentNode, NodeWrapper } from '../services/worksheet-viewer.service';

@Component({
  selector: 'app-worksheet-viewer',
  templateUrl: './worksheet-viewer.component.html',
  styleUrls: ['./worksheet-viewer.component.scss']
})
export class WorksheetViewerComponent implements OnInit, OnDestroy {
  tableHeader: TableHeader[][] = [
    // Primary headers
    [
      new TableHeader('Gene', '1'),
      new TableHeader('Regulon', '1'),
      new TableHeader('Uniprot', '1'),
      new TableHeader('String', '1'),
      new TableHeader('Go Enrichment', '3'),
      new TableHeader('Ecocyc', '1')
    ],
    // Secondary headers
    [
      new TableHeader('', '1'),
      new TableHeader('', '1'),
      new TableHeader('', '1'),
      new TableHeader('', '1'),
      new TableHeader('Molecular Function', '1'),
      new TableHeader('Biological Process', '1'),
      new TableHeader('Cellular Componenet', '1'),
      new TableHeader('', '1'),
    ]
  ];

  tableEntries: string[][];
  loadTask: BackgroundTask<string, Worksheet>;
  loadTaskSubscription: Subscription;
  sheetname: string;
  neo4jId: number;
  ncbiNodes: string[];
  ncbiIds: number[];
  uniprotNodes: string[];
  regulonNodes: string[];
  stringNodes: string[];
  molecularGoNodes: string[];
  biologicalGoNodes: string[];
  cellularGoNodes: string[];
  ecocycGoNodes: string[];


  @Input() worksheetId: string = '1';

  constructor(private readonly worksheetViewerService: WorksheetViewerService) {}

  ngOnInit() {
    this.loadTask = new BackgroundTask(
      (worksheetId: string) => this.worksheetViewerService.getWorksheet(worksheetId),
    );
    this.loadTaskSubscription = this.loadTask.results$.subscribe(({result: worksheet}) => {
      this.sheetname = worksheet.sheetname;
      this.neo4jId = worksheet.neo4jNodeId;
      this.worksheetViewerService.getNCBINodes(this.neo4jId).subscribe((result)=> {
        this.ncbiNodes = result.map((wrapper) => wrapper.x.name);
        this.ncbiIds = result.map((wrapper) => wrapper.neo4jID);
        this.getDomains();
      })
    });
    this.loadTask.update(this.worksheetId);
  }

  ngOnDestroy() {
    this.loadTaskSubscription.unsubscribe();
  }

  getDomains() {
    /* Domain specific api requests
    this.worksheetViewerService.getNCBIUniprot(this.ncbiIds).subscribe((result)=> {
      this.uniprotNodes = result.map((wrapper) => wrapper.x ? wrapper.x.gene_name : '');
    })
    this.worksheetViewerService.getNCBIRegulon(this.ncbiIds).subscribe((result)=> {
      this.regulonNodes = result.map((wrapper) => wrapper.x ? wrapper.x.regulondb_id : '');
    })
    this.worksheetViewerService.getNCBIString(this.ncbiIds).subscribe((result)=> {
      this.stringNodes = result.map((wrapper) => wrapper.x ? wrapper.x.name : '');
    })
    this.worksheetViewerService.getNCBIBiologicalGo(this.ncbiIds).subscribe((result)=> {
      this.biologicalGoNodes = result.map((wrapper) => wrapper.x ? wrapper.x.description : '');
    })
    this.worksheetViewerService.getNCBICellularGo(this.ncbiIds).subscribe((result)=> {
      this.cellularGoNodes= result.map((wrapper) => wrapper.x ? wrapper.x.description : '');
    })
    this.worksheetViewerService.getNCBIMolecularGo(this.ncbiIds).subscribe((result)=> {
      this.molecularGoNodes = result.map((wrapper) => wrapper.x ? wrapper.x.description : '');
    })
    this.worksheetViewerService.getNCBIEcocyc(this.ncbiIds).subscribe((result)=> {
      this.ecocycGoNodes = result.map((wrapper) => wrapper.x ? wrapper.x.biocyc_id : '');
    })
    */
    this.worksheetViewerService.getNCBIEnrichmentDomains(this.ncbiIds).subscribe((result)=> {
      this.tableEntries = result.map((wrapper) => this.processEnrichmentNodeArray(wrapper));
      for (var i = 0; i < this.ncbiNodes.length; i++) {
        this.tableEntries[i].unshift(this.ncbiNodes[i])
      }
    })
  }

  // Process wrapper to convert domain data into string array that represents domain columns.
  processEnrichmentNodeArray(arr: NodeWrapper[]): string[]{
    const result: string[] = [];
    result[0] = arr[0].x ? arr[0].x.regulondb_id : '';
    result[1] = arr[1].x ? arr[1].x.name : '';
    result[2] = arr[2].x ? arr[2].x.name : '';
    result[3] = arr[3].x ? arr[3].x.description : '';
    result[4] = arr[4].x ? arr[4].x.description : '';
    result[5] = arr[5].x ? arr[5].x.description : '';
    result[6] = arr[6].x ? arr[6].x.biocyc_id : '';
    return result;
  }
}
