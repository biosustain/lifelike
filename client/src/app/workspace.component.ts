import {
  AfterContentChecked,
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnChanges,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { CdkDragDrop, CdkDragMove, CdkDragRelease } from '@angular/cdk/drag-drop';

import { isNil } from 'lodash';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';

import { UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { ViewService } from 'app/file-browser/services/view.service';
import { CopyLinkDialogComponent } from 'app/shared/components/dialog/copy-link-dialog.component';
import { Pane, Tab, WorkspaceManager } from 'app/shared/workspace-manager';

import { SplitComponent } from 'angular-split';

@Component({
  selector: 'app-workspace',
  templateUrl: './workspace.component.html',
  styleUrls: ['./workspace.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class WorkspaceComponent implements AfterViewInit, OnChanges, AfterContentChecked {
  @ViewChild('container', {static: true, read: ElementRef}) container: ElementRef;
  @ViewChild('splitComponent', {static: false}) splitComponent: SplitComponent;
  panes$: Observable<Pane[]>;

  lastTabDragTarget: Element = null;

  constructor(protected readonly workspaceManager: WorkspaceManager,
              protected readonly modalService: NgbModal,
              protected readonly viewService: ViewService) {
    this.panes$ = this.workspaceManager.panes$;
  }

  ngAfterViewInit() {
    this.workspaceManager.initialLoad();
  }

  ngOnChanges() {
    this.workspaceManager.save();
  }

  ngAfterContentChecked() {
    this.workspaceManager.applyPendingChanges();
  }

  tabDropped(event: CdkDragDrop<Pane>) {
    const to = event.container.data;
    const from = event.previousContainer.data;
    this.workspaceManager.moveTab(from, event.previousIndex, to, event.currentIndex);
  }

  addTab(pane: Pane, url: string) {
    this.workspaceManager.openTabByUrl(pane, url);
  }

  duplicateTab(pane: Pane, tab: Tab) {
    this.workspaceManager.navigateByUrl({
      url: tab.url,
      extras: {newTab: true}
    });
  }

  copyLinkToTab(pane: Pane, tab: Tab) {
    const modalRef = this.modalService.open(CopyLinkDialogComponent);
    modalRef.componentInstance.url = 'Generating link...';
    const urlSubscription = this.viewService.getShareableLink(tab.getComponent(), tab.url).subscribe(({href}) => {
      modalRef.componentInstance.url = href;
    });
    // todo: use hidden after update of ng-bootstrap >= 8.0.0
    // https://ng-bootstrap.github.io/#/components/modal/api#NgbModalRef
    modalRef.result.then(
      () => urlSubscription.unsubscribe(),
      () => urlSubscription.unsubscribe()
    );
    return modalRef.result;
  }

  closeTab(pane: Pane, tab: Tab) {
    const performClose = () => {
      pane.deleteTab(tab);
      this.workspaceManager.save();
      this.workspaceManager.emitEvents();
    };
    if (this.workspaceManager.shouldConfirmTabUnload(tab)) {
      if (confirm('Close tab? Changes you made may not be saved.')) {
        performClose();
      }
    } else {
      performClose();
    }
  }

  closeOtherTabs(pane: Pane, tab: Tab) {
    this.closeTabs(pane, pane.tabs.filter(o => o !== tab));
  }

  closeAllTabs(pane: Pane) {
    this.closeTabs(pane, pane.tabs.slice());
  }

  closeTabs(pane: Pane, targetTabs: Tab[]) {
    let canClose = true;
    for (const targetTab of targetTabs) {
      if (this.workspaceManager.shouldConfirmTabUnload(targetTab)) {
        canClose = !!confirm('Close tabs? Changes you made may not be saved.');
        break;
      }
    }
    if (canClose) {
      for (const targetTab of targetTabs) {
        pane.deleteTab(targetTab);
      }
      this.workspaceManager.save();
      this.workspaceManager.emitEvents();
    }
  }

  clearWorkbench() {
    for (const pane of this.workspaceManager.panes.panes) {
      this.closeAllTabs(pane);
    }
  }

  handleTabClick(e, pane: Pane, tab: Tab) {
    if (e && (e.which === 2 || e.button === 4)) {
      this.closeTab(pane, tab);
    } else {
      this.setActiveTab(pane, tab);
    }
    e.preventDefault();
  }

  splitterDragEnded(result) {
    result.sizes.forEach((size, index) => {
      this.workspaceManager.panes.panes[index].size = size;
    });
    this.workspaceManager.save();
  }

  setActiveTab(pane: Pane, tab: Tab) {
    pane.activeTab = tab;
    this.workspaceManager.save();
  }

  setFocus(pane: Pane) {
    this.workspaceManager.focusedPane = pane;
  }

  canAddPane() {
    return this.workspaceManager.panes.panes.length === 1;
  }

  addPane() {
    this.workspaceManager.panes.getOrCreate('right');
    this.workspaceManager.save();
  }

  closeRightPane() {
    this.workspaceManager.panes.delete(this.workspaceManager.panes.get('right'));
    this.workspaceManager.save();
  }

  shouldConfirmUnload(): boolean {
    const result = this.workspaceManager.shouldConfirmUnload();
    if (result) {
      result.pane.activeTab = result.tab;
      return true;
    } else {
      return false;
    }
  }

  cdkDragMoved($event: CdkDragMove) {
    const dragTarget = document.elementFromPoint($event.pointerPosition.x, $event.pointerPosition.y);
    if (dragTarget !== this.lastTabDragTarget) {
      if (!isNil(this.lastTabDragTarget)) {
        const synthDragLeaveEvent = new DragEvent('dragleave');
        this.lastTabDragTarget.dispatchEvent(synthDragLeaveEvent);
      }
      const synthDragEnterEvent = new DragEvent('dragenter');
      dragTarget.dispatchEvent(synthDragEnterEvent);
      this.lastTabDragTarget = dragTarget;
    }
  }

  cdkDragReleased($event: CdkDragRelease<Tab>) {
    const tab: Tab = $event.source.data;
    const dropRect = document.getElementsByClassName('cdk-drag-preview')[0].getBoundingClientRect();
    const dropTarget = document.elementFromPoint(dropRect.x + (dropRect.width / 2), dropRect.y + (dropRect.height / 2));
    const synthDropEvent = new DragEvent('drop', {dataTransfer: new DataTransfer()});
    synthDropEvent.dataTransfer.effectAllowed = 'all';
    synthDropEvent.dataTransfer.setData('text/plain', 'This text came from a tab!');
    synthDropEvent.dataTransfer.setData('application/lifelike-node', JSON.stringify({
      display_name: tab.title,
      label: 'link',
      sub_labels: [],
      data: {
        sources: [
          {
            domain: tab.title,
            url: tab.url
          }
        ]
      }
    } as Partial<UniversalGraphNode>));
    dropTarget.dispatchEvent(synthDropEvent);
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event) {
    if (this.shouldConfirmUnload()) {
      event.returnValue = 'Leave page? Changes you made may not be saved';
    }
  }

  calculateFontAwesomeIcon(s: string) {
    if (s == null) {
      return 'window-maximize';
    } else if (s.includes(' ')) {
      return s;
    } else {
      return 'fa fa-' + s;
    }
  }
}

class PlacedPane {
  constructor(readonly pane: Pane, readonly width: number) {
  }
}
