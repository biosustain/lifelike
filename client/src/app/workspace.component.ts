import {
  AfterContentChecked,
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnChanges,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Pane, Tab, WorkspaceManager } from './shared/workspace-manager';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SplitComponent } from 'angular-split';

@Component({
  selector: 'app-workspace',
  templateUrl: './workspace.component.html',
  styleUrls: ['./workspace.component.scss'],
})
export class WorkspaceComponent implements AfterViewInit, OnChanges, AfterContentChecked {
  @ViewChild('container', {static: true, read: ElementRef}) container: ElementRef;
  @ViewChild('splitComponent', {static: false}) splitComponent: SplitComponent;
  panes$: Observable<Pane[]>;

  constructor(readonly workspaceManager: WorkspaceManager) {
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

  addTab(pane: Pane) {
    this.workspaceManager.openTabByUrl(pane, '/welcome');
  }

  closeTab(pane: Pane, tab: Tab) {
    const performClose = () => {
      pane.deleteTab(tab);
      if (pane.id === 'right' && pane.tabs.length === 0) {
        this.workspaceManager.panes.delete(pane);
      }
      if (pane.id === 'left' && pane.tabs.length === 0) {
        this.workspaceManager.openTabByUrl(pane, '/dt/map');
      }
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

  handleTabClick(e, pane: Pane, tab: Tab) {
    if (e && (e.which === 2 || e.button === 4 )) {
      this.closeTab(pane, tab);
    } else {
      this.setActiveTab(pane, tab);
    }
    e.preventDefault();
  }

  splitterDragEnded() {
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
    const pane = this.workspaceManager.panes.getOrCreate('right');
    this.workspaceManager.openTabByUrl(pane, '/welcome');
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

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event) {
    if (this.shouldConfirmUnload()) {
      event.returnValue = 'Leave page? Changes you made may not be saved';
    }
  }
}

class PlacedPane {
  constructor(readonly pane: Pane, readonly width: number) {
  }
}
