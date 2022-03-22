import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Component, Input } from '@angular/core';

import { Pane, Tab, WorkspaceManager } from 'app/shared/workspace-manager';

@Component({
  selector: 'app-workspace-pane',
  templateUrl: './workspace-pane.component.html',
  styleUrls: ['./workspace-pane.component.scss']
})
export class WorkspacePaneComponent {
  @Input() data: Pane;
  @Input() hasSiblings = false;

  constructor(
    protected readonly workspaceManager: WorkspaceManager
  ) {}

  closeRightPane() {
    this.workspaceManager.paneManager.delete(this.workspaceManager.paneManager.get('right'));
    this.workspaceManager.save();
  }

  setFocus() {
    this.workspaceManager.focusedPane = this.data;
  }

  tabDropped(event: CdkDragDrop<Pane>) {
    const to = event.container.data;
    const from = event.previousContainer.data;
    this.workspaceManager.moveTab(from, event.previousIndex, to, event.currentIndex);
  }

  addTab(url: string) {
    this.workspaceManager.openTabByUrl(this.data, url);
  }

  setActiveTab(tab: Tab) {
    this.data.activeTab = tab;
    this.workspaceManager.save();
  }

  duplicateTab(tab: Tab) {
    this.workspaceManager.navigateByUrl({
      url: tab.url,
      extras: {newTab: true}
    });
  }

  closeTab(tab: Tab) {
    this.workspaceManager.closeTab(this.data, tab);
  }

  closeOtherTabs(tab: Tab) {
    this.workspaceManager.closeTabs(this.data, this.data.tabs.filter(o => o !== tab));
  }

  closeAllTabs() {
    this.workspaceManager.closeTabs(this.data, this.data.tabs.slice());
  }

  clearWorkbench() {
    this.workspaceManager.clearWorkbench();
  }
}
