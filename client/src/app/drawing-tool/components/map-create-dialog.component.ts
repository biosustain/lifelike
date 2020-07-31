import { Component } from '@angular/core';
import { MapEditDialogComponent } from './map-edit-dialog.component';

@Component({
  selector: 'app-map-create-dialog',
  templateUrl: './map-create-dialog.component.html',
})
export class MapCreateDialogComponent extends MapEditDialogComponent {
  currentMap = {
    label: '',
    description: '',
    graph: {
      nodes: [],
      edges: [],
    },
  };
}
