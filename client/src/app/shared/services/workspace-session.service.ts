import { Injectable, OnDestroy } from '@angular/core';

import { forEachRight } from 'lodash-es';

import { AuthenticationService } from 'app/auth/services/authentication.service';

import { Pane } from '../workspace-manager';

const LOCAL_STORAGE_KEY = 'lifelike_workspace_session';

export interface TabData {
  url: string;
  title: string;
  fontAwesomeIcon: string;
}

interface PaneData {
  id: string;
  size: number | undefined;
  tabs: TabData[];
  activeTabHistory: number[];
}

interface SessionData {
  panes: PaneData[];
}

interface PaneCreateOptions {
  size: number | undefined;
}

export interface WorkspaceSessionLoader {
  createPane(id: string, options: PaneCreateOptions): void;
  loadTab(id: string, data: TabData): void;
  setPaneActiveTabHistory(id: string, activeTabHistory: number[]): void;
}

@Injectable({
  providedIn: 'root',
})
export class WorkspaceSessionService implements OnDestroy {
  constructor(readonly authService: AuthenticationService) {}

  private readonly storageUpdateSubscription = this.authService.loggedIn$.subscribe((loggedIn) => {
    this.storage = loggedIn ? localStorage : sessionStorage;
  });

  private storage: Storage = sessionStorage;

  ngOnDestroy(): void {
    this.storageUpdateSubscription?.unsubscribe();
  }

  save(panes: Pane[]) {
    const data: SessionData = {
      panes: panes.map((pane) => {
        return {
          id: pane.id,
          size: pane.size,
          tabs: pane.tabs.map((tab) => ({
            url: tab.url,
            title: tab.title,
            fontAwesomeIcon: tab.fontAwesomeIcon,
          })),
          activeTabHistory: [...pane.activeTabHistory.values()].map((tab) =>
            pane.tabs.indexOf(tab)
          ),
        };
      }),
    };
    this.storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  }

  load(loader: WorkspaceSessionLoader): boolean {
    const rawData = this.storage.getItem(LOCAL_STORAGE_KEY);
    if (rawData) {
      const data: SessionData = JSON.parse(rawData);
      for (const pane of data.panes) {
        loader.createPane(pane.id, {
          size: pane.size,
        });

        // Tabs are saved in the correct order, but will be in reverse order if we don't preemptively reverse them when loading.
        forEachRight(pane.tabs, (tab) => {
          loader.loadTab(pane.id, tab);
        });

        loader.setPaneActiveTabHistory(pane.id, pane.activeTabHistory);
      }
      return true;
    } else {
      return false;
    }
  }
}
