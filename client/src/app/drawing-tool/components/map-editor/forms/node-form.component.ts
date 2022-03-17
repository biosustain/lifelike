import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

import { cloneDeep, startCase } from 'lodash-es';

import { annotationTypes, annotationTypesMap } from 'app/shared/annotation-styles';
import { nullIfEmpty, RecursivePartial } from 'app/shared/utils/types';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { InternalSearchService } from 'app/shared/services/internal-search.service';
import { SearchType } from 'app/search/shared';
import { DETAIL_NODE_LABELS, isCommonNodeDisplayName, UniversalGraphNode, } from 'app/drawing-tool/services/interfaces';

import { EntityForm } from './entity-form';

@Component({
  selector: 'app-node-form',
  styleUrls: ['./node-form.component.scss'],
  templateUrl: './node-form.component.html',
})
export class NodeFormComponent extends EntityForm {
  @ViewChild('option') selectedOption: ElementRef;

  nodeTypeChoices = annotationTypes;

  originalNode: UniversalGraphNode;
  updatedNode: UniversalGraphNode;

  @Output() save = new EventEmitter<{
    originalData: RecursivePartial<UniversalGraphNode>,
    updatedData: RecursivePartial<UniversalGraphNode>,
  }>();

  previousLabel: string;

  fixedType = false;

  constructor(
    protected readonly workspaceManager: WorkspaceManager,
    protected readonly internalSearch: InternalSearchService
  ) {
    super(workspaceManager, internalSearch);
  }

  get nodeSubtypeChoices() {
    const type = annotationTypesMap.get(this.node.label);
    if (type && type.subtypes) {
      return type.subtypes;
    } else {
      return [];
    }
  }

  get hyperlinks() {
    return this.node.data?.hyperlinks ?? [];
  }

  get node() {
    return this.updatedNode;
  }

  @Input()
  set node(node) {
    this.previousLabel = node.label;
    this.fixedType = node.label === 'image';

    this.originalNode = cloneDeep(node);
    this.originalNode.style = this.originalNode.style || {};


    this.updatedNode = cloneDeep(node);
    this.updatedNode.data.sources = this.updatedNode.data.sources || [];
    this.updatedNode.data.hyperlinks = this.updatedNode.data.hyperlinks || [];
    this.updatedNode.style = this.updatedNode.style || {};
  }

  // TODO: Inspect and possibly clean this mess.
  handleTypeChange() {
    const fromDetailNode = DETAIL_NODE_LABELS.has(this.previousLabel);
    const toDetailNode = DETAIL_NODE_LABELS.has(this.node.label);

    // Swap node display name and detail when switching to a Note or Link (LL-1946)
    if (!fromDetailNode && toDetailNode) {
      // If we are changing to a detail node, swap the detail and display name (sometimes)
      if (nullIfEmpty(this.node.data.detail) === null
        && this.node.display_name != null
        && !isCommonNodeDisplayName(this.previousLabel, this.node.display_name)) {
        this.node.style.showDetail = true;
        this.node.data.detail = this.node.display_name;
        this.node.display_name = startCase(this.node.label);
      } else if (nullIfEmpty(this.node.data.detail) !== null) {
        // If we aren't swapping, but we already have detail, turn on detail mode
        // to keep the behavior consistent
        this.node.style.showDetail = true;
      }
    } else if (fromDetailNode && !toDetailNode) {
      // If we are moving away from a detail node, restore the display name (sometimes)
      if ((nullIfEmpty(this.node.display_name) === null
          || isCommonNodeDisplayName(this.previousLabel, this.node.display_name))
        && nullIfEmpty(this.node.data.detail) !== null
        && this.node.data.detail.length <= 50) {
        this.node.display_name = this.node.data.detail;
        this.node.data.detail = '';
      }
    } else if (fromDetailNode && toDetailNode) {
      // If we go from detail node to detail node type (i.e. link -> note), we actually
      // need to update the display name if it's a common name (like Link if used
      // on a link node, or Note if used on a note node), because we
      // use that to figure out whether to replace the display name with
      // the detail (above)
      if (isCommonNodeDisplayName(this.previousLabel, this.node.display_name)) {
        this.node.display_name = startCase(this.node.label);
      }
    }

    this.previousLabel = this.node.label;

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
          sources: this.originalNode.data.sources,
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
          bgColor: this.originalNode.style.bgColor,
          lineType: this.originalNode.style.lineType,
          lineWidthScale: this.originalNode.style.lineWidthScale,
          showDetail: this.originalNode.style.showDetail,
        },
      },
      updatedData: {
        data: {
          sources: this.updatedNode.data.sources,
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
          bgColor: this.updatedNode.style.bgColor,
          lineType: this.updatedNode.style.lineType,
          lineWidthScale: this.updatedNode.style.lineWidthScale,
          showDetail: this.updatedNode.style.showDetail,
        },
      },
    });
    this.originalNode = cloneDeep(this.updatedNode);
  }

  /**
   * Create a blank hyperlink template to add to model
   */
  addHyperlink() {
    this.node.data.hyperlinks = this.node.data?.hyperlinks ?? [];
    const [domain, url] = ['', ''];
    this.node.data.hyperlinks.push({url, domain});
  }

  mayShowDetailText() {
    return this.node.label === 'note' || this.node.label === 'link';
  }

  searchMapNodeInVisualizer(node) {
    return this.internalSearch.visualizer_tmp_fix(node.display_name, {
      entities: [node.label]
    });
  }

  searchMapNodeInContent(node, type: SearchType | string) {
    return this.internalSearch.fileContents(node.display_name, {types: [type]});
  }
}
