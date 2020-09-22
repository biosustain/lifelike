import { Component, OnInit, OnDestroy } from '@angular/core';

import { TableHeader } from './generic-table.component';

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
  numColumns = 8;

  loremIpsum = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus vel ex tellus. Fusce vestibulum erat pharetra bibendum malesuada. Suspendisse potenti. Mauris ac metus metus. Nunc non enim vel purus iaculis iaculis. Etiam magna lorem, faucibus eu libero quis, ultrices vestibulum enim. Nam quam lorem, dictum a fermentum non, blandit sed nisl.';

  entries: string[][] = [
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

  constructor() {}

  ngOnInit() {}

  ngOnDestroy() {}
}
