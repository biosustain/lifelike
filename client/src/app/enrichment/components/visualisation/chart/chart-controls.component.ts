import { Component, EventEmitter, Output } from '@angular/core';
import analyses from 'app/enrichment/analyses';

@Component({
  selector: 'app-chart-controls',
  template: `
    <div ngbDropdown class="module-toolbar d-flex align-items-center ml-auto d-inline-block">
      <div class="btn-group" role="group">
        <button class="btn btn-secondary" id="dropdownBasic1" ngbDropdownToggle>
          By: {{ selected.description }}
        </button>
        <div ngbDropdownMenu class="ml-auto" aria-labelledby="dropdownBasic1">
          <button
            class="dropdown-item"
            [ngClass]="{'active': selected == analysis}"
            (click)="changeSelection(analysis)"
            *ngFor="let analysis of analyses"
          >
            {{ analysis.description }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class ChartControlsComponent {
  analyses: Analysis[] = analyses;
  selected: Analysis = this.analyses[0];

  @Output() changed: EventEmitter<Analysis> = new EventEmitter();

  changeSelection(analysis) {
    this.selected = analysis;
    this.changed.emit(analysis.id);
  }
}

interface Analysis {
  id: string;
  description: string;
}
