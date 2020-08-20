import { Component, EventEmitter, Input, Output } from '@angular/core';

import { cloneDeep } from 'lodash';
import { UniversalGraphEdge, UniversalGraphNode } from '../../services/interfaces';
import { LINE_HEAD_TYPES } from '../../services/line-head-types';
import { LINE_TYPES } from '../../services/line-types';
import { RecursivePartial } from '../../../shared/utils/types';
import { openLink } from '../../../shared/utils/browser';
import { PALETTE_COLORS } from '../../services/palette';
import { isNullOrUndefined } from 'util';

@Component({
  selector: 'app-edge-form',
  templateUrl: './edge-form.component.html',
})
export class EdgeFormComponent {

  lineTypeChoices = [
    [null, {
      name: '(Default)',
    }],
    ...LINE_TYPES.entries(),
  ];

  lineHeadTypeChoices = [
    [null, {
      name: '(Default)',
    }],
    ...LINE_HEAD_TYPES.entries(),
  ];

  paletteChoices = [...PALETTE_COLORS];

  originalEdge: UniversalGraphEdge;
  updatedEdge: UniversalGraphEdge;

  @Output() save = new EventEmitter<{
    originalData: RecursivePartial<UniversalGraphEdge>,
    updatedData: RecursivePartial<UniversalGraphEdge>
  }>();
  @Output() delete = new EventEmitter<object>();
  @Output() sourceOpen = new EventEmitter<string>();

  activeTab: string;

  get edge() {
    return this.updatedEdge;
  }

  get hyperlinks() {
    return isNullOrUndefined(this.edge.data.hyperlinks) ? [] : this.edge.data.hyperlinks;
  }

  // tslint:disable-next-line: adjacent-overload-signatures
  @Input()
  set edge(edge) {
    this.originalEdge = cloneDeep(edge);
    this.originalEdge.data = this.originalEdge.data || {};
    this.originalEdge.style = this.originalEdge.style || {};

    this.updatedEdge = cloneDeep(edge);
    this.updatedEdge.data = this.updatedEdge.data || {};
    this.updatedEdge.style = this.updatedEdge.style || {};
  }

  doSave() {
    this.save.next({
      originalData: {
        label: this.originalEdge.label,
        data: {
          hyperlink: this.originalEdge.data.hyperlink,
          hyperlinks: this.originalEdge.data.hyperlinks,
          detail: this.originalEdge.data.detail,
        },
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
        data: {
          hyperlink: this.updatedEdge.data.hyperlink,
          hyperlinks: this.updatedEdge.data.hyperlinks,
          detail: this.updatedEdge.data.detail,
        },
        style: {
          fontSizeScale: this.updatedEdge.style.fontSizeScale,
          strokeColor: this.updatedEdge.style.strokeColor,
          lineType: this.updatedEdge.style.lineType,
          lineWidthScale: this.updatedEdge.style.lineWidthScale,
          sourceHeadType: this.updatedEdge.style.sourceHeadType,
          targetHeadType: this.updatedEdge.style.targetHeadType,
        },
      },
    });
    this.originalEdge = cloneDeep(this.updatedEdge);
  }

  doDelete(): void {
    this.delete.next();
  }

  /**
   * Allow user to navigate to a link in a new tab
   */
  goToLink(hyperlink) {
    openLink(hyperlink);
  }

  /**
   * Create a blank hyperlink template to add to model
   */
  addHyperlink() {
    if (isNullOrUndefined(this.edge.data.hyperlinks)) {
      this.edge.data.hyperlinks = [];
    }

    const [domain, url] = ['', ''];
    this.edge.data.hyperlinks.push({url, domain});
  }

  /**
   * Remove hyperlink from specified index
   * @param i - index of hyperlink to remove
   */
  removeHyperlink(i) {
    this.edge.data.hyperlinks.splice(i, 1);
    this.doSave();
  }

  /**
   * Bring user to original source of node information
   */
  goToSource(url): void {
    this.sourceOpen.next(url);
  }

}
