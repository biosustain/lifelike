import { Component } from '@angular/core';

// TODO: find a better place for this interface
export interface FileElement {
  name: string;
  modifiedAt: string;
  modifiedBy: string;
  annotation: string;
}

// TODO: remove ELEMENT_DATA once the endpoint is ready
const ELEMENT_DATA: FileElement[] = [
  {name: 'file1', modifiedAt: 'Yesterday', modifiedBy: 'User1', annotation: ''},
  {name: 'file2', modifiedAt: 'Today', modifiedBy: 'User1', annotation: ''},
  {name: 'file3', modifiedAt: 'Tomorrow', modifiedBy: 'User2', annotation: ''},
  {name: 'file4', modifiedAt: 'Never', modifiedBy: 'User2', annotation: ''},
];

@Component({
  selector: 'app-file-browser',
  templateUrl: './file-browser.component.html',
  styleUrls: ['./file-browser.component.scss']
})
export class FileBrowserComponent {
  displayedColumns: string[] = ['name', 'modifiedAt', 'modifiedBy', 'annotation'];
  dataSource = ELEMENT_DATA;
}
