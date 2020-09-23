import { Component, OnInit, OnDestroy, Input } from '@angular/core';

import { TableHeader } from './generic-table.component';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { DirectoryContent } from 'app/interfaces/projects.interface';
import { Subscription } from 'rxjs';
import { Worksheet, WorksheetViewerService } from '../services/worksheet-viewer.service';

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

  loremIpsum = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus vel ex tellus. Fusce vestibulum erat pharetra bibendum malesuada. Suspendisse potenti. Mauris ac metus metus. Nunc non enim vel purus iaculis iaculis. Etiam magna lorem, faucibus eu libero quis, ultrices vestibulum enim. Nam quam lorem, dictum a fermentum non, blandit sed nisl.';

  tableEntries: string[][] = [
    [
      this.loremIpsum,
      this.loremIpsum,
      this.loremIpsum,
      this.loremIpsum,
      this.loremIpsum,
      this.loremIpsum,
      this.loremIpsum,
      this.loremIpsum,
    ],
    [
      this.loremIpsum,
      this.loremIpsum,
      this.loremIpsum,
      this.loremIpsum,
      this.loremIpsum,
      this.loremIpsum,
      this.loremIpsum,
      this.loremIpsum,
    ]
  ];
  loadTask: BackgroundTask<string, Worksheet>;
  loadTaskSubscription: Subscription;
  sheetname: string;
  neo4jId: number;
  nodes: number[];

  @Input() worksheetId: string = '5';

  constructor(private readonly worksheetViewerService: WorksheetViewerService) {}

  ngOnInit() {
    this.loadTask = new BackgroundTask(
      (worksheetId: string) => this.worksheetViewerService.getWorksheet(worksheetId),
    );
    this.loadTaskSubscription = this.loadTask.results$.subscribe(({result: worksheet}) => {
      this.sheetname = worksheet.sheetname;
      this.neo4jId = worksheet.neo4jNodeId;
      this.worksheetViewerService.getNCBINodes(this.neo4jId).subscribe(({result: nodes})=> {
        this.nodes = nodes;
      })
    });
    this.loadTask.update(this.worksheetId);
  }

  ngOnDestroy() {
    this.loadTaskSubscription.unsubscribe();
  }
}
