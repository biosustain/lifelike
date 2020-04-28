import { Component, OnInit, Input } from '@angular/core';
import { GraphSelectionData } from 'app/drawing-tool/services/interfaces';

@Component({
  selector: 'app-read-panel',
  templateUrl: './read-panel.component.html',
  styleUrls: ['./read-panel.component.scss']
})
export class ReadPanelComponent implements OnInit {
  /** The edge or node focused on */
  @Input() focusedEntity: GraphSelectionData = null;

  get node() {
    if (!this.focusedEntity) { return null; }

    return this.focusedEntity.nodeData;
  }

  get nodeStyle() {
    return this.focusedEntity.nodeData.group || '';
  }

  constructor() { }

  ngOnInit() {
  }

}
