import { Component, EventEmitter, Input, Output } from '@angular/core';

import { cloneDeep } from 'lodash';
import { UniversalGraphEdge, UniversalGraphNode, UniversalGraphEntity } from '../../services/interfaces';
import { LINE_HEAD_TYPES } from '../../services/line-head-types';
import { LINE_TYPES } from '../../services/line-types';
import { RecursivePartial } from '../../../graph-viewer/utils/types';
import { openLink } from '../../../shared/utils/browser';
import { PALETTE_COLORS } from '../../services/palette';
import { annotationTypesMap, annotationTypes } from 'app/shared/annotation-styles';
import { isNullOrUndefined } from 'util';


abstract class EntityForm {
  lineTypeChoices = [
    [null, {
      name: '(Default)',
    }],
    ...LINE_TYPES.entries(),
  ];
  paletteChoices = [...PALETTE_COLORS];

  originalEntity: UniversalGraphEntity;
  updatedEntity: UniversalGraphEntity;

  @Output() save = new EventEmitter<{
    originalData: RecursivePartial<UniversalGraphEntity>,
    updatedData: RecursivePartial<UniversalGraphEntity>,
  }>();
  @Output() delete = new EventEmitter<object>();
  @Output() sourceOpen = new EventEmitter<string>();

  activeTab: string;

  get entity(): UniversalGraphEntity {
    return this.updatedEntity;
  }

  @Input()
  set entity(entity: UniversalGraphEntity) {
    this.originalEntity = cloneDeep(entity);
    this.originalEntity.data = this.originalEntity.data || {}; // This was only in edge-form
    this.originalEntity.style = this.originalEntity.style || {};

    this.updatedEntity = cloneDeep(entity);
    this.updatedEntity.data = this.updatedEntity.data || {}; // This was only in edge-form
    this.updatedEntity.style = this.updatedEntity.style || {};
  }

  get hyperlinks() {
    return isNullOrUndefined(this.entity.data.hyperlinks) ? [] : this.entity.data.hyperlinks;
  }

  doSave() {}

  /**
   * Delete the current node.
   */
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
    if (isNullOrUndefined(this.entity.data.hyperlinks)) {
      this.entity.data.hyperlinks = [];
    }

    const [domain, url] = ['', ''];
    this.entity.data.hyperlinks.push({url, domain});
  }

  /**
   * Remove hyperlink from specified index
   * @param i - index of hyperlink to remove
   */
  removeHyperlink(i) {
    this.entity.data.hyperlinks.splice(i, 1);
    this.doSave();
  }

  /**
   * Bring user to original source of node information
   */
  goToSource(): void {
    if (this.entity.data.source) {
      this.sourceOpen.next(this.entity.data.source);
    }
  }
}


@Component({
  selector: 'app-edge-form',
  templateUrl: './edge-form.component.html',
})
export class EdgeFormComponent extends EntityForm {
  get entity(): UniversalGraphEdge {
    return this.updatedEntity as UniversalGraphEdge;
  }

  @Input()
  set entity(entity: UniversalGraphEdge) {
    this.originalEntity = cloneDeep(entity);
    this.originalEntity.data = this.originalEntity.data || {}; // This was only in edge-form
    this.originalEntity.style = this.originalEntity.style || {};

    this.updatedEntity = cloneDeep(entity);
    this.updatedEntity.data = this.updatedEntity.data || {}; // This was only in edge-form
    this.updatedEntity.style = this.updatedEntity.style || {};
  }

  lineHeadTypeChoices = [
    [null, {
      name: '(Default)',
    }],
    ...LINE_HEAD_TYPES.entries(),
  ];

  doSave() {
    this.save.next({
      originalData: {
        label: this.originalEntity.label,
        data: {
          hyperlink: this.originalEntity.data.hyperlink,
          hyperlinks: this.originalEntity.data.hyperlinks,
          detail: this.originalEntity.data.detail,
        },
        style: {
          fontSizeScale: this.originalEntity.style.fontSizeScale,
          strokeColor: this.originalEntity.style.strokeColor,
          lineType: this.originalEntity.style.lineType,
          lineWidthScale: this.originalEntity.style.lineWidthScale,
          sourceHeadType: (this.originalEntity as UniversalGraphEdge).style.sourceHeadType,
          targetHeadType: (this.originalEntity as UniversalGraphEdge).style.targetHeadType,
        },
      },
      updatedData: {
        label: this.updatedEntity.label,
        data: {
          hyperlink: this.updatedEntity.data.hyperlink,
          hyperlinks: this.updatedEntity.data.hyperlinks,
          detail: this.updatedEntity.data.detail,
        },
        style: {
          fontSizeScale: this.updatedEntity.style.fontSizeScale,
          strokeColor: this.updatedEntity.style.strokeColor,
          lineType: this.updatedEntity.style.lineType,
          lineWidthScale: this.updatedEntity.style.lineWidthScale,
          sourceHeadType: (this.updatedEntity as UniversalGraphEdge).style.sourceHeadType,
          targetHeadType: (this.updatedEntity as UniversalGraphEdge).style.targetHeadType,
        },
      },
    });
    this.originalEntity = cloneDeep(this.updatedEntity);
  }
}

@Component({
  selector: 'app-node-form',
  templateUrl: './node-form.component.html',
})
export class NodeFormComponent extends EntityForm {
  get entity(): UniversalGraphNode {
    return this.updatedEntity as UniversalGraphNode;
  }

  @Input()
  set entity(entity: UniversalGraphNode) {
    this.originalEntity = cloneDeep(entity);
    this.originalEntity.style = this.originalEntity.style || {};

    this.updatedEntity = cloneDeep(entity);
    this.updatedEntity.style = this.updatedEntity.style || {};
  }

  nodeTypeChoices = annotationTypes;

  get nodeSubtypeChoices() {
    const type = annotationTypesMap.get(this.entity.label);
    if (type && type.subtypes) {
      return type.subtypes;
    } else {
      return [];
    }
  }

  doSave() {
    this.save.next({
      originalData: {
        display_name: (this.originalEntity as UniversalGraphNode).display_name,
        label: this.originalEntity.label,
        data: {
          hyperlink: this.originalEntity.data.hyperlink,
          hyperlinks: this.originalEntity.data.hyperlinks,
          detail: this.originalEntity.data.detail,
          subtype: this.originalEntity.data.subtype,
        },
        style: {
          fontSizeScale: this.originalEntity.style.fontSizeScale,
          fillColor: (this.originalEntity as UniversalGraphNode).style.fillColor,
          strokeColor: this.originalEntity.style.strokeColor,
          lineType: this.originalEntity.style.lineType,
          lineWidthScale: this.originalEntity.style.lineWidthScale,
          showDetail: (this.originalEntity as UniversalGraphNode).style.showDetail,
        },
      },
      updatedData: {
        data: {
          hyperlink: this.updatedEntity.data.hyperlink,
          hyperlinks: this.updatedEntity.data.hyperlinks,
          detail: this.updatedEntity.data.detail,
          subtype: this.updatedEntity.data.subtype,
        },
        display_name: (this.updatedEntity as UniversalGraphNode).display_name,
        label: this.updatedEntity.label,
        style: {
          fontSizeScale: this.updatedEntity.style.fontSizeScale,
          fillColor: (this.updatedEntity as UniversalGraphNode).style.fillColor,
          strokeColor: this.updatedEntity.style.strokeColor,
          lineType: this.updatedEntity.style.lineType,
          lineWidthScale: this.updatedEntity.style.lineWidthScale,
          showDetail: (this.updatedEntity as UniversalGraphNode).style.showDetail,
        },
      },
    });
    this.originalEntity = cloneDeep(this.updatedEntity);
  }

  checkSubtype() {
    if (this.entity.data && this.entity.data.subtype) {
      let found = false;
      for (const subtype of this.nodeSubtypeChoices) {
        if (subtype === this.entity.data.subtype) {
          found = true;
          break;
        }
      }
      if (!found) {
        this.entity.data.subtype = null;
      }
    }
  }

  mayShowDetailText() {
    return this.entity.label === 'note';
  }
}
