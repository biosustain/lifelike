import { Component, OnInit, OnDestroy, Input } from '@angular/core';

import { TableHeader, TableCell, TableLink } from './generic-table.component';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { DirectoryContent } from 'app/interfaces/projects.interface';
import { Subscription, zip } from 'rxjs';
import { Worksheet, WorksheetViewerService, NCBINode, NCBIWrapper, EnrichmentNode, NodeWrapper} from '../services/worksheet-viewer.service';

@Component({
  selector: 'app-worksheet-viewer',
  templateUrl: './worksheet-viewer.component.html',
  styleUrls: ['./worksheet-viewer.component.scss']
})
export class WorksheetViewerComponent implements OnInit, OnDestroy {
  tableHeader: TableHeader[][] = [
    // Primary headers
    [
      {name: 'NCBI Gene', span: '1'},
      {name: 'Regulon', span: '1'},
      {name: 'Uniprot', span: '1'},
      {name: 'String', span: '1'},
      {name: 'Go Enrichment', span: '3'},
      {name: 'Ecocyc', span: '1'}
    ],
    // Secondary headers
    [
      {name: '', span: '1'},
      {name: '', span: '1'},
      {name: '', span: '1'},
      {name: '', span: '1'},
      {name: 'Molecular Function', span: '1'},
      {name: 'Biological Process', span: '1'},
      {name: 'Cellular Component', span: '1'},
      {name: '', span: '1'}
    ]
  ];

  tableEntries: TableCell[][];
  loadTask: BackgroundTask<string, Worksheet>;
  loadTaskSubscription: Subscription;
  sheetname: string;
  neo4jId: number;
  ncbiNodes: NCBINode[];
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
        this.ncbiNodes = result.map((wrapper) => wrapper.x);
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
    this.worksheetViewerService.getNCBIEnrichmentDomains(this.ncbiIds).subscribe((result)=> {
      this.tableEntries = result.map((wrapper) => this.processEnrichmentNodeArray(wrapper));
      for (var i = 0; i < this.ncbiNodes.length; i++) {
        this.tableEntries[i].unshift({text: this.ncbiNodes[i].name, singleLink: {link: 'https://www.ncbi.nlm.nih.gov/gene/' + this.ncbiNodes[i].id, linkText: 'NCBI Link'}})
      }
    })
  }

  // Process wrapper to convert domain data into string array that represents domain columns.
  processEnrichmentNodeArray(arr: Array<NodeWrapper>): TableCell[]{
    const result: TableCell[] = [];
    result[0] = arr[0].x ? {text: arr[0].x.regulondb_id} : {text: ''};
    result[1] = arr[1].x ? {text: arr[1].x.name, singleLink: {link: 'http://identifiers.org/uniprot/' + arr[1].x.id, linkText: 'Uniprot Link'}} : {text: ''};
    result[2] = arr[2].x ? {text: arr[2].x.name} : {text: ''};
    const molecularArray: TableLink[] = []; 
    const biologicalArray: TableLink[] = []; 
    const cellularArray: TableLink[] = []; 
    arr[3].xArray.map((node) => molecularArray.push({linkText: node.name + ', ', link: 'http://identifiers.org/go/' + node.id}));
    arr[4].xArray.map((node) => biologicalArray.push({linkText: node.name + ', ', link: 'http://identifiers.org/go/' + node.id}));
    arr[5].xArray.map((node) => cellularArray.push({linkText: node.name + ', ', link: 'http://identifiers.org/go/' + node.id}));
    result[3] = arr[3].xArray ? {text: '', multiLink: molecularArray} : {text: ''};
    result[4] = arr[4].xArray ? {text: '', multiLink: biologicalArray} : {text: ''};
    result[5] = arr[5].xArray ? {text: '', multiLink: cellularArray} : {text: ''};
    result[6] = arr[6].x ? {text: arr[6].x.biocyc_id, singleLink: {link: 'http://identifiers.org/biocyc/' + arr[6].x.biocyc_id, linkText: 'Biocyc Link'}} : {text: ''};
    return result;
  }
}
