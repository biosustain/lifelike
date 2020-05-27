import { Component, EventEmitter, Input, Output } from '@angular/core';

import { cloneDeep } from 'lodash';
import { UniversalGraphEdge, UniversalGraphNode } from '../../services/interfaces';
import { LINE_HEAD_TYPES } from '../../services/line-head-types';
import { LINE_TYPES } from '../../services/line-types';
import { RecursivePartial } from '../../../graph-viewer/utils/types';

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

  originalEdge: UniversalGraphEdge;
  updatedEdge: UniversalGraphEdge;

  @Output() save = new EventEmitter<{
    originalData: RecursivePartial<UniversalGraphEdge>,
    updatedData: RecursivePartial<UniversalGraphEdge>
  }>();
  @Output() delete = new EventEmitter<object>();

  get edge() {
    return this.updatedEdge;
  }

  @Input()
  set edge(edge) {
    this.originalEdge = cloneDeep(edge);
    this.originalEdge.style = this.originalEdge.style || {};

    this.updatedEdge = cloneDeep(edge);
    this.updatedEdge.style = this.updatedEdge.style || {};
  }

  doSave() {
    this.save.next({
      originalData: {
        label: this.originalEdge.label,
        style: {
          fontSizeScale: this.originalEdge.style.fontSizeScale,
          strokeColor: this.originalEdge.style.strokeColor,
          lineType: this.originalEdge.style.lineType,
          lineWidthScale: this.originalEdge.style.lineWidthScale,
          sourceHeadType: this.originalEdge.style.sourceHeadType,
          targetHeadType: this.originalEdge.style.targetHeadType,
        },
      },
      updatedData: {
        label: this.updatedEdge.label,
        style: {
          fontSizeScale: this.updatedEdge.style.fontSizeScale,
          strokeColor: this.updatedEdge.style.strokeColor,
          lineType: this.updatedEdge.style.lineType,
          lineWidthScale: this.updatedEdge.style.lineWidthScale,
          sourceHeadType: this.updatedEdge.style.sourceHeadType,
          targetHeadType: this.updatedEdge.style.targetHeadType,
        },
      }
    });
    this.originalEdge = cloneDeep(this.updatedEdge);
  }

  doDelete(): void {
    this.delete.next();
  }

}
