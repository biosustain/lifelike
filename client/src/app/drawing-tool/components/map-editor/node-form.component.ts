import { Component, EventEmitter, Input, Output } from '@angular/core';

import { cloneDeep } from 'lodash';
import { UniversalGraphNode } from '../../services/interfaces';
import { LINE_TYPES } from '../../services/line-types';
import { annotationTypes, annotationTypesMap } from '../../../shared/annotation-styles';
import { RecursivePartial } from '../../../graph-viewer/utils/types';
import { openLink } from '../../../shared/utils/browser';
import { PALETTE_COLORS } from '../../services/palette';

@Component({
  selector: 'app-node-form',
  templateUrl: './node-form.component.html',
})
export class NodeFormComponent {

  nodeTypeChoices = annotationTypes;
  lineTypeChoices = [
    [null, {
      name: '(Default)',
    }],
    ...LINE_TYPES.entries(),
  ];
  paletteChoices = [...PALETTE_COLORS];

  originalNode: UniversalGraphNode;
  updatedNode: UniversalGraphNode;

  @Output() save = new EventEmitter<{
    originalData: RecursivePartial<UniversalGraphNode>,
    updatedData: RecursivePartial<UniversalGraphNode>,
  }>();
  @Output() delete = new EventEmitter<object>();
  @Output() sourceOpen = new EventEmitter<string>();

  activeTab: string;

  get nodeSubtypeChoices() {
    const type = annotationTypesMap.get(this.node.label);
    if (type && type.subtypes) {
      return type.subtypes;
    } else {
      return [];
    }
  }

  get node() {
    return this.updatedNode;
  }

  @Input()
  set node(node) {
    this.originalNode = cloneDeep(node);
    this.originalNode.style = this.originalNode.style || {};

    this.updatedNode = cloneDeep(node);
    this.updatedNode.style = this.updatedNode.style || {};
  }

  checkSubtype() {
    if (this.node.data && this.node.data.subtype) {
      let found = false;
      for (const subtype of this.nodeSubtypeChoices) {
        if (subtype === this.node.data.subtype) {
          found = true;
          break;
        }
      }
      if (!found) {
        this.node.data.subtype = null;
      }
    }
  }

  doSave() {
    this.save.next({
      originalData: {
        data: {
          hyperlink: this.originalNode.data.hyperlink,
          hyperlinks: this.originalNode.data.hyperlinks,
          detail: this.originalNode.data.detail,
          subtype: this.originalNode.data.subtype,
        },
        display_name: this.originalNode.display_name,
        label: this.originalNode.label,
        style: {
          fontSizeScale: this.originalNode.style.fontSizeScale,
          fillColor: this.originalNode.style.fillColor,
          strokeColor: this.originalNode.style.strokeColor,
          lineType: this.originalNode.style.lineType,
          lineWidthScale: this.originalNode.style.lineWidthScale,
          showDetail: this.originalNode.style.showDetail,
        },
      },
      updatedData: {
        data: {
          hyperlink: this.updatedNode.data.hyperlink,
          hyperlinks: this.updatedNode.data.hyperlinks,
          detail: this.updatedNode.data.detail,
          subtype: this.updatedNode.data.subtype,
        },
        display_name: this.updatedNode.display_name,
        label: this.updatedNode.label,
        style: {
          fontSizeScale: this.updatedNode.style.fontSizeScale,
          fillColor: this.updatedNode.style.fillColor,
          strokeColor: this.updatedNode.style.strokeColor,
          lineType: this.updatedNode.style.lineType,
          lineWidthScale: this.updatedNode.style.lineWidthScale,
          showDetail: this.updatedNode.style.showDetail,
        },
      },
    });
    this.originalNode = cloneDeep(this.updatedNode);
  }

  /**
   * Delete the current node.
   */
  doDelete(): void {
    this.delete.next();
  }

  /**
   * Allow user to navigate to a link in a new tab
   */
  goToLink() {
    openLink(this.node.data.hyperlink);
  }

  /**
   * Bring user to original source of node information
   */
  goToSource(url): void {
    this.sourceOpen.next(url);
  }

  mayShowDetailText() {
    return this.node.label === 'note';
  }
}
