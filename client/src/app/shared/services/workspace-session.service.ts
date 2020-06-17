import { Injectable } from '@angular/core';
import { Pane} from '../workspace-manager';

const LOCAL_STORAGE_KEY = 'lifelike_workspace_session';

export interface TabData {
  url: string;
}

interface PaneData {
  id: string;
  tabs: TabData[];
  activeTabHistory: number[];
}

interface SessionData {
  panes: PaneData[];
}

export interface WorkspaceSessionLoader {
  createPane(id: string): void;
  loadTab(id: string, url: string): void;
  setPaneActiveTabHistory(id: string, activeTabHistory: number[]): void;
}

@Injectable({
  providedIn: 'root',
})
export class WorkspaceSessionService {
  save(panes: Pane[]) {
    const data: SessionData = {
      panes: panes.map(pane => {
        const activeTabHistoryArray = [...pane.activeTabHistory.values()];
        return {
          id: pane.id,
          tabs: pane.tabs.map(tab => ({
            url: tab.url,
          })),
          activeTabHistory: [...pane.activeTabHistory.values()].map((tab) => pane.tabs.indexOf(tab)),
        };
      }),
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  }

  load(loader: WorkspaceSessionLoader): boolean {
    const rawData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (rawData) {
      const data: SessionData = JSON.parse(rawData);
      for (const pane of data.panes) {
        loader.createPane(pane.id);
        for (const tab of pane.tabs) {
          loader.loadTab(pane.id, tab.url);
        }
        loader.setPaneActiveTabHistory(pane.id, pane.activeTabHistory);
      }
      return true;
    } else {
      return false;
    }
  }
}
