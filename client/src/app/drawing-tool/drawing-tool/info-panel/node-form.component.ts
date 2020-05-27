import { Component, EventEmitter, Input, Output } from '@angular/core';

import { cloneDeep } from 'lodash';
import { LaunchApp, UniversalGraphNode } from '../../services/interfaces';
import { LINE_TYPES } from '../../services/line-types';
import { annotationTypes } from '../../../shared/annotation-styles';
import { RecursivePartial } from '../../../graph-viewer/utils/types';

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
    ...LINE_TYPES.entries()
  ];

  originalNode: UniversalGraphNode;
  updatedNode: UniversalGraphNode;

  @Output() save = new EventEmitter<{
    originalData: RecursivePartial<UniversalGraphNode>,
    updatedData: RecursivePartial<UniversalGraphNode>,
  }>();
  @Output() delete = new EventEmitter<object>();
  @Output() appOpen = new EventEmitter<LaunchApp>();

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

  doSave() {
    this.save.next({
      originalData: {
        data: {
          hyperlink: this.originalNode.data.hyperlink,
          detail: this.originalNode.data.detail,
        },
        display_name: this.originalNode.display_name,
        label: this.originalNode.label,
        style: {
          fontSizeScale: this.originalNode.style.fontSizeScale,
          fillColor: this.originalNode.style.fillColor,
          strokeColor: this.originalNode.style.strokeColor,
          lineType: this.originalNode.style.lineType,
          lineWidthScale: this.originalNode.style.lineWidthScale,
        },
      },
      updatedData: {
        data: {
          hyperlink: this.updatedNode.data.hyperlink,
          detail: this.updatedNode.data.detail,
        },
        display_name: this.updatedNode.display_name,
        label: this.updatedNode.label,
        style: {
          fontSizeScale: this.updatedNode.style.fontSizeScale,
          fillColor: this.updatedNode.style.fillColor,
          strokeColor: this.updatedNode.style.strokeColor,
          lineType: this.updatedNode.style.lineType,
          lineWidthScale: this.updatedNode.style.lineWidthScale,
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
    const hyperlink = this.node.data.hyperlink;
    if (hyperlink.includes('http')) {
      window.open(hyperlink, '_blank');
    } else if (hyperlink.includes('mailto')) {
      window.open(hyperlink);
    } else {
      window.open('http://' + hyperlink);
    }
  }

  /**
   * Bring user to original source of node information
   */
  goToSource(): void {
    if (this.node.data.source.includes('/dt/pdf')) {
      const prefixLink = '/dt/pdf/';
      const [
        fileId,
        page,
        coordA,
        coordB,
        coordC,
        coordD
      ] = this.node.data.source.replace(prefixLink, '').split('/');
      // Emit app command with annotation payload
      this.appOpen.emit({
          app: 'pdf-viewer',
          arg: {
            // tslint:disable-next-line: radix
            pageNumber: parseInt(page),
            fileId,
            coords: [
              parseFloat(coordA),
              parseFloat(coordB),
              parseFloat(coordC),
              parseFloat(coordD)
            ]
          }
        }
      );
    } else if (this.node.data.source.includes('/dt/map')) {
      const hyperlink = window.location.origin + this.node.data.source;
      window.open(hyperlink, '_blank');
    }
  }

}
