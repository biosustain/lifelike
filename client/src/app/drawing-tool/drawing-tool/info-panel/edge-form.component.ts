import { Component, EventEmitter, Input, Output } from '@angular/core';

import { cloneDeep } from 'lodash';
import { UniversalGraphEdge } from '../../services/interfaces';
import { LINE_HEAD_TYPES } from '../../services/line-head-types';
import { LINE_TYPES } from '../../services/line-types';

@Component({
  selector: 'app-edge-form',
  templateUrl: './edge-form.component.html',
})
export class EdgeFormComponent {

  lineTypeChoices = [
    [null, {
      name: '(Default)',
    }],
    ...LINE_TYPES.entries()
  ];
  lineHeadTypeChoices = [
    [null, {
      name: '(Default)',
    }],
    ...LINE_HEAD_TYPES.entries(),
  ];

  targetEdge: UniversalGraphEdge;

  @Output() save = new EventEmitter<object>();
  @Output() delete = new EventEmitter<object>();

  get edge() {
    return this.targetEdge;
  }

  @Input()
  set edge(edge) {
    const targetEdge = cloneDeep(edge);
    targetEdge.style = targetEdge.style || {};
    this.targetEdge = targetEdge;
  }

  doSave() {
    this.save.next(this.targetEdge);
  }

  doDelete(): void {
    this.delete.next();
  }

}
