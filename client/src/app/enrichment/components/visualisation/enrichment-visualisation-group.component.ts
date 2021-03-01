import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Subscription } from 'rxjs';
import { ModuleProperties } from 'app/shared/modules';
import { FilesystemObject } from '../../../file-browser/models/filesystem-object';

@Component({
  selector: 'app-enrichment-visualisation-group',
  templateUrl: './enrichment-visualisation-group.component.html',
  styleUrls: ['./enrichment-visualisation-group.component.scss']
})
export class EnrichmentVisualisationGroupComponent {
  constructor() {
  }

  _data;

  @Input()
  set data(d) {
    this._data = d;
  }

  get data() {
    return this._data;
  }

  @Input() geneNames: string[];
  @Input() organism: string;
  @Input() analysis: string;

  @Input() title;

  paramsSubscription: Subscription;
  queryParamsSubscription: Subscription;

  returnUrl: string;

  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();
  projectName: string;
  @Input() fileId: string;
  object: FilesystemObject;
  neo4jId: number;
  importGenes: string[];
  unmatchedGenes: string;
  duplicateGenes: string;
  wordVisibilityMap: Map<string, boolean> = new Map<string, boolean>();
  legend: Map<string, string> = new Map<string, string>();
  filtersPanelOpened = false;
  clickableWords = false;

  activeTab: string;

  showMore = false;

  showMoreToggle() {
    this.showMore = !this.showMore;
  }
}
