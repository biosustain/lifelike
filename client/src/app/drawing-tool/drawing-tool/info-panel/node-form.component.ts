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

  targetNode: UniversalGraphNode;

  @Output() save = new EventEmitter<object>();
  @Output() delete = new EventEmitter<object>();
  @Output() appOpen = new EventEmitter<LaunchApp>();

  get node() {
    return this.targetNode;
  }

  @Input()
  set node(node) {
    const targetNode = cloneDeep(node);
    targetNode.style = targetNode.style || {};
    this.targetNode = targetNode;
  }

  doSave() {
    // Only update the fields that are affected
    const savedNode: RecursivePartial<UniversalGraphNode> = {
      data: {
        hyperlink: this.targetNode.data.hyperlink,
        detail: this.targetNode.data.detail,
      },
      display_name: this.targetNode.display_name,
      label: this.targetNode.label,
      style: this.targetNode.style,
    };

    this.save.next(savedNode);
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
