import {Component, Input, OnChanges, OnInit, SimpleChanges, ViewChild} from '@angular/core';
import {MatTableDataSource} from '@angular/material/table';
import {MatPaginator} from '@angular/material/paginator';
import {Nodes} from '../containers/node-search.component';

@Component({
  selector: 'app-node-result-list',
  templateUrl: './node-result-list.component.html',
  styleUrls: ['./node-result-list.component.scss']
})

export class NodeResultListComponent implements OnInit, OnChanges {
  @Input() nodes: Nodes[] = [];
  displayedColumns: string[] = ['id', 'name', 'type', 'domain'];
  dataSource = new MatTableDataSource<Nodes>(this.nodes);
  @ViewChild(MatPaginator, {static: false}) paginator: MatPaginator;
  childMode = false;

  constructor() {
  }

  ngOnInit() {
    this.dataSource.paginator = this.paginator;
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.dataSource = new MatTableDataSource<Nodes>(this.nodes);
    this.dataSource.paginator = this.paginator;
  }
}
