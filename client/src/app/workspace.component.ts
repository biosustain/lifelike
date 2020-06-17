import { Component, HostListener } from '@angular/core';
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
    const tab = pane.activeTab;
    if (tab) {
      const performClose = () => {
        pane.deleteTab(tab);
        if (pane.id === 'right' && pane.tabs.length === 0) {
          this.workspaceManager.panes.delete(pane);
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
