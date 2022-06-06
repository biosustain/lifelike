import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Component, Input } from '@angular/core';

import { Pane, Tab, TabDefaults, WorkspaceManager } from 'app/shared/workspace-manager';

@Component({
  selector: 'app-workspace-pane',
  templateUrl: './workspace-pane.component.html',
  styleUrls: ['./workspace-pane.component.scss']
})
export class WorkspacePaneComponent {
  @Input() pane: Pane;
  @Input() hasSiblings = false;

  NEW_TAB_OPTIONS: TabDefaults[] = [
      { title: 'File Browser', fontAwesomeIcon: 'fa fa-layer-group', url: '/projects' },
      { title: 'Knowledge Graph', fontAwesomeIcon: 'fa fa-chart-network', url: '/search/graph' },
      { title: 'Search', fontAwesomeIcon: 'fa fa-search', url: '/search/content' },
  ];

  constructor(
    protected readonly workspaceManager: WorkspaceManager
  ) {}

  closeRightPane() {
    this.workspaceManager.paneManager.delete(this.workspaceManager.paneManager.get('right'));
    this.workspaceManager.save();
  }

  setFocus() {
    this.workspaceManager.focusedPane = this.pane;
  }

  tabDropped(event: CdkDragDrop<Pane>) {
    const to = event.container.data;
    const from = event.previousContainer.data;
    this.workspaceManager.moveTab(from, event.previousIndex, to, event.currentIndex);
  }

  addTab(tab: TabDefaults) {
    this.workspaceManager.openTabByUrl(this.pane, tab.url, undefined, tab);
  }

  setActiveTab(tab: Tab) {
    this.pane.activeTab = tab;
    this.workspaceManager.save();
  }

  duplicateTab(tab: Tab) {
    this.workspaceManager.navigateByUrl({
      url: tab.url,
      extras: {newTab: true}
    });
  }

  closeTab(tab: Tab) {
    this.workspaceManager.closeTab(this.pane, tab);
  }

  closeOtherTabs(tab: Tab) {
    this.workspaceManager.closeTabs(this.pane, this.pane.tabs.filter(o => o !== tab));
  }

  closeAllTabs() {
    this.workspaceManager.closeTabs(this.pane, this.pane.tabs.slice());
  }

  clearWorkbench() {
    this.workspaceManager.clearWorkbench();
  }
}
