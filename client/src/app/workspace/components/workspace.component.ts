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

import { Observable } from 'rxjs';

import { Pane, WorkspaceManager } from 'app/shared/workspace-manager';

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

  constructor(
    protected readonly workspaceManager: WorkspaceManager
  ) {
    this.panes$ = this.workspaceManager.panes$;
  }

  ngOnChanges() {
    this.workspaceManager.save();
  }

  ngAfterContentChecked() {
    this.workspaceManager.applyPendingChanges();
  }

  ngAfterViewInit() {
    this.workspaceManager.initialLoad();
  }

  splitterDragEnded(result) {
    result.sizes.forEach((size, index) => {
      this.workspaceManager.paneManager.panes[index].size = size;
    });
    this.workspaceManager.save();
  }

  canAddPane() {
    return this.workspaceManager.paneManager.panes.length === 1;
  }

  addPane() {
    this.workspaceManager.paneManager.getOrCreate('right');
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

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event) {
    if (this.shouldConfirmUnload()) {
      event.returnValue = 'Leave page? Changes you made may not be saved';
    }
  }
}
