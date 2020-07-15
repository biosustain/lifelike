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
  displayedColumns: string[] = ['id', 'name', 'type', 'domain', 'description'];
  dataSource = new MatTableDataSource<Nodes>([]);
  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;
  childMode = false;
  showFilter = false;

  ngOnInit() {
    this.dataSource.filterPredicate = (data: Nodes, filter: string) =>
      data.description.toLocaleLowerCase().includes(filter);
    this.dataSource.paginator = this.paginator;
  }

  ngOnChanges(changes: SimpleChanges): void {
    const propName = 'nodes'; // making linter happy
    this.dataSource.data = changes[propName].currentValue;
  }

  applyFilter(event: Event) {
    const filterValue: string = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLocaleLowerCase();
  }
}
