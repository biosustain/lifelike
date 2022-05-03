import {
  AfterViewInit,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild
} from '@angular/core';

import { LINE_TYPES } from 'app/drawing-tool/services/line-types';
import { BG_PALETTE_COLORS, PALETTE_COLORS } from 'app/drawing-tool/services/palette';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { openPotentialInternalLink } from 'app/shared/utils/browser';
import { InfoPanel } from 'app/drawing-tool/models/info-panel';

export abstract class EntityForm implements AfterViewInit {
  @ViewChild('displayName', {static: false}) displayNameRef: ElementRef;
  @ViewChild('scrollWrapper', {static: false}) scrollWrapper: ElementRef;

  lineTypeChoices = [
    [null, {
      name: '(Default)',
    }],
    ...LINE_TYPES.entries(),
  ];

  readonly paletteChoices = PALETTE_COLORS;
  readonly bgPaletteChoices = BG_PALETTE_COLORS;
  ASSUMED_PANEL_HEIGHT = 450;

  @Input() infoPanel: InfoPanel;
  @Output() delete = new EventEmitter<object>();
  @Output() sourceOpen = new EventEmitter<string>();

  overflow = false;

  protected constructor(
    protected readonly workspaceManager: WorkspaceManager,
  ) {
  }

  /**
   * Emit save event on user changes
   */
  abstract doSave();

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
