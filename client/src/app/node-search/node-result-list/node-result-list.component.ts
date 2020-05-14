import {Component, OnInit, ViewChild} from '@angular/core';
import {SelectionModel} from '@angular/cdk/collections';
import {MatTableDataSource} from '@angular/material/table';
import {MatPaginator} from '@angular/material/paginator';

export interface Nodes {
  position: number;
  database: string;
  type: string;
  name: string;
}

const ELEMENT_DATA: Nodes[] = [
  {position: 1, database: 'Biocyc', type: 'Gene', name: 'cysB'},
  {position: 2, database: 'Uniprot', type: 'Gene', name: 'gyrA'},
  {position: 3, database: 'Go', type: 'Chemical', name: 'adenosine'},
  {position: 4, database: 'Biocyc', type: 'Gene', name: 'cysB'},
  {position: 5, database: 'Uniprot', type: 'Gene', name: 'gyrA'},
  {position: 6, database: 'Go', type: 'Chemical', name: 'adenosine'},
  {position: 7, database: 'Biocyc', type: 'Gene', name: 'cysB'},
  {position: 8, database: 'Uniprot', type: 'Gene', name: 'gyrA'},
  {position: 9, database: 'Go', type: 'Chemical', name: 'adenosine'},
  {position: 10, database: 'Go', type: 'Chemical', name: 'adenosine'},
];

@Component({
  selector: 'app-node-result-list',
  templateUrl: './node-result-list.component.html',
  styleUrls: ['./node-result-list.component.scss']
})

export class NodeResultListComponent implements OnInit {
  displayedColumns: string[] = ['name', 'type', 'database', 'actions'];
  dataSource = new MatTableDataSource<Nodes>(ELEMENT_DATA);
  selection = new SelectionModel<Nodes>(true, []);
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;
  constructor() {
  }

  ngOnInit() {
    this.dataSource.paginator = this.paginator;
  }

  onClick() {
  }
}
