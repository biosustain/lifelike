import { Component } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Pane, Tab, WorkspaceManager } from './shared/workspace-manager';

@Component({
  selector: 'app-workspace',
  templateUrl: './workspace.component.html',
  styleUrls: ['./workspace.component.scss'],
})
export class WorkspaceComponent {
  constructor(readonly workspaceManager: WorkspaceManager) {
  }

  tabDropped(event: CdkDragDrop<Pane>) {
    const to = event.container.data;
    const from = event.previousContainer.data;
    this.workspaceManager.moveTab(from, event.previousIndex, to, event.currentIndex);
  }

  addTab(pane: Pane) {
    this.workspaceManager.openTabByUrl(pane, '/welcome');
  }

  closeTab(pane: Pane) {
    pane.deleteActiveTab();
    if (pane.id === 'right' && pane.tabs.length === 0) {
      this.workspaceManager.panes.delete(pane);
    }
    this.workspaceManager.emitEvents();
  }

  setActiveTab(pane: Pane, tab: Tab) {
    pane.activeTab = tab;
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
}
