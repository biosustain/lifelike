import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormControl } from '@angular/forms';

import { ReplaySubject } from 'rxjs';
import {
  flow as _flow,
  groupBy as _groupBy,
  identity as _identity,
  mapValues as _mapValues,
  sortBy as _sortBy,
} from 'lodash/fp';

import { ChatGPT } from '../../../../ChatGPT';

@Component({
  selector: 'app-model-control',
  templateUrl: './model-control.component.html'
})
export class ModelControlComponent implements OnChanges {
  @Input() modelControl!: FormControl;
  @Input() models!: string[];

  protected readonly groupedModels$ = new ReplaySubject<Record<string, string[]>>(1);

  private groupModels = _flow(_groupBy(ChatGPT.getModelGroup), _mapValues(_sortBy(_identity)));

  ngOnChanges({models}: SimpleChanges) {
    if (models) {
      this.groupedModels$.next(this.groupModels(models.currentValue));
    }
  }

  getModelGroup(model: string) {
    return ChatGPT.getModelGroup(model);
  }
}
