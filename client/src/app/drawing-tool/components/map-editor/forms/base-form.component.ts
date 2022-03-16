import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild
} from '@angular/core';

import { cloneDeep, isNil } from 'lodash-es';

import { LINE_TYPES } from 'app/drawing-tool/services/line-types';
import { BG_PALETTE_COLORS, PALETTE_COLORS } from 'app/drawing-tool/services/palette';
import { UniversalGraphEntity } from 'app/drawing-tool/services/interfaces';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { InternalSearchService } from 'app/shared/services/internal-search.service';
import { openPotentialInternalLink } from 'app/shared/utils/browser';

import { InfoPanel } from '../../../models/info-panel';

export class BaseFormComponent implements AfterViewInit {
  @ViewChild('displayName', {static: false}) displayNameRef: ElementRef;
  @ViewChild('scrollWrapper', {static: false}) scrollWrapper: ElementRef;
  @ViewChild('option') selectedOption: ElementRef;

  lineTypeChoices = [
    [null, {
      name: '(Default)',
    }],
    ...LINE_TYPES.entries(),
  ];

  paletteChoices = [...PALETTE_COLORS];
  bgPaletteChoices = [...BG_PALETTE_COLORS];
  private ASSUMED_PANEL_HEIGHT = 450;

  originalEntity: UniversalGraphEntity;
  updatedEntity: UniversalGraphEntity;

  @Input() infoPanel: InfoPanel;
  // @Output() save = new EventEmitter<{
  //   originalData: RecursivePartial<UniversalGraphNode>,
  //   updatedData: RecursivePartial<UniversalGraphNode>,
  // }>();
  @Output() delete = new EventEmitter<object>();
  @Output() sourceOpen = new EventEmitter<string>();

  previousLabel: string;

  overflow = false;

  constructor(
    protected readonly workspaceManager: WorkspaceManager,
    protected readonly internalSearch: InternalSearchService
  ) {
  }

  changeOverflow(newValue) {
    if (this.overflow !== newValue) {
      // stops overflowing
      if (!newValue && this.infoPanel.activeTab === 'search') {
        this.infoPanel.activeTab = 'properties';
      }
      this.overflow = newValue;
    }
  }

  @HostListener('window:resize')
  onResize() {
    const {
      scrollWrapper: {
        nativeElement: {
          offsetHeight
        }
      },
      ASSUMED_PANEL_HEIGHT
    } = this;
    this.changeOverflow(offsetHeight < ASSUMED_PANEL_HEIGHT * 2);
  }

  ngAfterViewInit() {
    setTimeout(() => this.onResize(), 0);
  }

  get entity() {
    return this.updatedEntity;
  }

  @Input()
  set entity(entity) {
    this.previousLabel = entity.label;

    this.originalEntity = cloneDeep(entity);
    this.originalEntity.style = this.originalEntity.style || {};


    this.updatedEntity = cloneDeep(entity);
    this.updatedEntity.data.sources = this.updatedEntity.data.sources || [];
    this.updatedEntity.data.hyperlinks = this.updatedEntity.data.hyperlinks || [];
    this.updatedEntity.style = this.updatedEntity.style || {};
  }

  get hyperlinks() {
    return this.entity.data?.hyperlinks ?? [];
  }

  // Note: this is just SHARED data, needs to be updated with individual ata
  getSaveData() {
    this.originalEntity = cloneDeep(this.updatedEntity);
    return {
      originalData: {
        data: {
          sources: this.originalEntity.data.sources,
          hyperlinks: this.originalEntity.data.hyperlinks,
          detail: this.originalEntity.data.detail,
          subtype: this.originalEntity.data.subtype,
        },
        label: this.originalEntity.label,
        style: {
          fontSizeScale: this.originalEntity.style.fontSizeScale,
          strokeColor: this.originalEntity.style.strokeColor,
          lineType: this.originalEntity.style.lineType,
          lineWidthScale: this.originalEntity.style.lineWidthScale,
        },
      },
      updatedData: {
        data: {
          sources: this.updatedEntity.data.sources,
          hyperlinks: this.updatedEntity.data.hyperlinks,
          detail: this.updatedEntity.data.detail,
          subtype: this.updatedEntity.data.subtype,
        },
        label: this.updatedEntity.label,
        style: {
          fontSizeScale: this.updatedEntity.style.fontSizeScale,
          strokeColor: this.updatedEntity.style.strokeColor,
          lineType: this.updatedEntity.style.lineType,
          lineWidthScale: this.updatedEntity.style.lineWidthScale,
        },
      },
    };
  }

  /**
   * Delete the current entity.
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
    if (isNil(this.entity.data.hyperlinks)) {
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
    // this.doSave();
  }

  /**
   * Bring user to original source of entity information
   */
  goToSource(url): void {
    this.sourceOpen.next(url);
  }

  focus() {
    if (this.displayNameRef != null) {
      const element = this.displayNameRef.nativeElement;
      element.focus();
      element.select();
    }
  }


}
