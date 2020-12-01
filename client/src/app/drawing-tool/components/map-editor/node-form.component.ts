import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { cloneDeep, startCase } from 'lodash';
import { DETAIL_NODE_LABELS, isCommonNodeDisplayName, UniversalGraphNode } from '../../services/interfaces';
import { LINE_TYPES } from '../../services/line-types';
import { annotationTypes, annotationTypesMap } from '../../../shared/annotation-styles';
import { nullIfEmpty, RecursivePartial } from '../../../shared/utils/types';
import { openPotentialInternalLink } from '../../../shared/utils/browser';
import { PALETTE_COLORS } from '../../services/palette';
import { isNullOrUndefined } from 'util';
import { WorkspaceManager } from '../../../shared/workspace-manager';

@Component({
  selector: 'app-node-form',
  templateUrl: './node-form.component.html',
})
export class NodeFormComponent implements AfterViewInit {
  @ViewChild('displayName', {static: false}) displayNameRef: ElementRef;

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
  previousLabel: string;

  constructor(protected readonly workspaceManager: WorkspaceManager) {
  }

  ngAfterViewInit() {
    setTimeout(() => this.focus(), 10);
  }

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

  get hyperlinks() {
    return isNullOrUndefined(this.node.data.hyperlinks) ? [] : this.node.data.hyperlinks;
  }

  // tslint:disable-next-line: adjacent-overload-signatures
  @Input()
  set node(node) {
    this.previousLabel = node.label;

    this.originalNode = cloneDeep(node);
    this.originalNode.style = this.originalNode.style || {};

    this.updatedNode = cloneDeep(node);
    this.updatedNode.style = this.updatedNode.style || {};

    setTimeout(() => this.focus(), 10);
  }

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
  goToLink(hyperlink) {
    openPotentialInternalLink(this.workspaceManager, hyperlink);
  }

  /**
   * Create a blank hyperlink template to add to model
   */
  addHyperlink() {
    if (isNullOrUndefined(this.node.data.hyperlinks)) {
      this.node.data.hyperlinks = [];
    }

    const [domain, url, isDatabase] = ['', '', false];
    this.node.data.hyperlinks.push({url, domain, isDatabase});
  }

  /**
   * Remove hyperlink from specified index
   * @param i - index of hyperlink to remove
   */
  removeHyperlink(i) {
    this.node.data.hyperlinks.splice(i, 1);
    this.doSave();
  }

  /**
   * Bring user to original source of node information
   */
  goToSource(url): void {
    this.sourceOpen.next(url);
  }

  mayShowDetailText() {
    return this.node.label === 'note' || this.node.label === 'link';
  }

  focus() {
    if (this.displayNameRef != null) {
      const element = this.displayNameRef.nativeElement;
      element.focus();
      element.select();
    }
  }
}
