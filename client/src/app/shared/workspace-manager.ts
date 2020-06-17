import {
  ComponentFactory,
  ComponentFactoryResolver,
  ComponentRef, EventEmitter, Injectable, Injector,
  StaticProvider,
  Type, ViewContainerRef,
} from '@angular/core';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  NavigationExtras,
  Router,
  RoutesRecognized,
  UrlTree,
} from '@angular/router';
import { filter } from 'rxjs/operators';
import { BehaviorSubject, Subscription } from 'rxjs';
import { moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ModuleAwareComponent } from './modules';

/**
 * Contains a component reference and re-creates it if it is destroyed
 * but requested again.
 */
export class Container<T> {
  private createdComponentRef: ComponentRef<T> = null;
  viewContainerRef: ViewContainerRef;

  constructor(private readonly tab: Tab,
              private readonly injector: Injector,
              private componentFactoryResolver: ComponentFactoryResolver,
              readonly component: Type<T>) {
  }

  detach() {
    if (this.viewContainerRef) {
      this.viewContainerRef.detach(0);
      this.viewContainerRef = null;
    }
  }

  get componentRef() {
    if (!this.createdComponentRef) {
      const factory: ComponentFactory<T> = this.componentFactoryResolver.resolveComponentFactory(this.component);
      this.createdComponentRef = factory.create(this.injector);
      const instance = this.createdComponentRef.instance as ModuleAwareComponent;
      const subscriptions: Subscription[] = [];
      if (instance.modulePropertiesChange) {
        subscriptions.push(instance.modulePropertiesChange.subscribe(properties => {
          this.tab.title = properties.title;
          this.tab.fontAwesomeIcon = properties.fontAwesomeIcon;
        }));
      }
      this.createdComponentRef.onDestroy(() => {
        this.createdComponentRef = null;
        for (const subscription of subscriptions) {
          subscription.unsubscribe();
        }
      });
    }
    return this.createdComponentRef;
  }

  destroy() {
    if (this.createdComponentRef) {
      this.createdComponentRef.destroy();
      this.createdComponentRef = null;
      this.viewContainerRef = null;
    }
  }
}

/**
 * Represents a tab with a title and possibly a component inside.
 */
export class Tab {
  title = 'New Tab';
  fontAwesomeIcon: string = null;
  component: Type<any>;
  providers: StaticProvider[] = [];
  container: Container<any>;

  constructor(private readonly injector: Injector,
              private componentFactoryResolver: ComponentFactoryResolver) {
  }

  replaceComponent(component: Type<any>, providers: StaticProvider[] = []) {
    this.destroy();

    this.container = new Container<any>(
      this,
      Injector.create({
        parent: this.injector,
        providers,
      }),
      this.componentFactoryResolver,
      component,
    );
  }

  detach() {
    if (this.container) {
      this.container.detach();
    }
  }

  destroy() {
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }
}

/**
 * Represents a collection of abs.
 */
export class Pane {
  tabs: Tab[] = [];
  activeTabHistory: Set<Tab> = new Set();

  constructor(readonly id: string,
              private readonly injector: Injector) {
  }

  get activeTab(): Tab | undefined {
    let active: Tab = null;
    for (const tab of this.activeTabHistory.values()) {
      active = tab;
    }
    return active;
  }

  set activeTab(tab: Tab) {
    if (tab != null) {
      this.activeTabHistory.delete(tab);
      this.activeTabHistory.add(tab);
    }
  }

  createTab(): Tab {
    const tab = new Tab(this.injector, this.injector.get<ComponentFactoryResolver>(ComponentFactoryResolver as any));
    this.tabs.push(tab);
    this.activeTab = tab;
    return tab;
  }

  getActive(): Tab | undefined {
    return this.activeTab;
  }

  getActiveOrCreate(): Tab {
    const tab = this.getActive();
    if (tab) {
      return tab;
    }
    if (this.tabs.length) {
      this.activeTab = this.tabs[0];
      return this.activeTab;
    }
    return this.createTab();
  }

  deleteTab(tab: Tab): boolean {
    for (let i = 0; i < this.tabs.length; i++) {
      if (this.tabs[i] === tab) {
        this.tabs.splice(i, 1);
        this.activeTabHistory.delete(tab);
        return true;
      }
    }
    return false;
  }

  handleTabMoveFrom(tab: Tab) {
    tab.detach();
    this.activeTabHistory.delete(tab);
  }

  handleTabMoveTo(tab: Tab) {
    this.activeTabHistory.add(tab);
  }

  deleteActiveTab(): boolean {
    const activeTab = this.activeTab;
    if (this.activeTab) {
      return this.deleteTab(activeTab);
    }
    return false;
  }

  destroy() {
    for (const tab of this.tabs) {
      this.deleteTab(tab);
    }
  }
}

/**
 * Manages a set of panes.
 */
export class PaneManager {
  panes: Pane[] = [];

  constructor(private readonly injector: Injector) {
  }

  create(id: string): Pane {
    const pane = new Pane(id, this.injector);
    this.panes.push(pane);
    return pane;
  }

  get(id: string): Pane | undefined {
    for (const pane of this.panes) {
      if (pane.id === id) {
        return pane;
      }
    }
    return null;
  }

  getOrCreate(id: string): Pane {
    const pane = this.get(id);
    if (pane) {
      return pane;
    }
    return this.create(id);
  }

  getFirstOrCreate() {
    const it = this.panes.values().next();
    return !it.done ? it.value : this.create('primary');
  }

  delete(pane: Pane): boolean {
    for (let i = 0; i < this.panes.length; i++) {
      if (this.panes[i] === pane) {
        this.panes.splice(i, 1);
        pane.destroy();
        return true;
      }
    }
    return false;
  }
}

@Injectable({
  providedIn: 'root',
})
export class WorkspaceManager {
  panes: PaneManager;
  private workspaceUrl = '/space/mine';
  focusedPane: Pane | undefined;
  private interceptNextRoute = false;
  panes$ = new BehaviorSubject<Pane[]>([]);

  constructor(private readonly router: Router,
              private readonly injector: Injector) {
    this.panes = new PaneManager(injector);
    this.hookRouter();

    const leftPane = this.panes.create('left');
    this.emitEvents();

    this.openTabByUrl(leftPane, '/welcome');
  }

  private hookRouter() {
    // Intercept changing routes and redirect to our workspace
    this.router.events
      .pipe(filter(event => event instanceof RoutesRecognized))
      .subscribe((event: RoutesRecognized) => {
        // Flag set to true if this route navigation was started by [appLink]
        if (this.interceptNextRoute) {
          this.interceptNextRoute = false;

          if (this.router.url !== this.workspaceUrl) {
            // If we're currently not in the workspace view, then navigate to
            // to the route in full size
            // TODO: Do we have to handle the 'extras' argument from navigateByUrl()?
            this.router.navigateByUrl(event.url);
          } else {
            // TODO: Support nested routes
            const routeSnapshot: ActivatedRouteSnapshot = this.getDeepestChild(event.state.root);

            const pane = this.focusedPane || this.panes.getFirstOrCreate();
            const tab = pane.getActiveOrCreate();

            // We are using undocumented API to create an ActivatedRoute that carries the parameters
            // from the URL -- this part is a little hacky
            // @ts-ignore
            const activatedRoute = new ActivatedRoute(new BehaviorSubject(routeSnapshot.url),
              new BehaviorSubject(routeSnapshot.params), new BehaviorSubject(routeSnapshot.queryParams),
              new BehaviorSubject(routeSnapshot.fragment), new BehaviorSubject(routeSnapshot.data),
              routeSnapshot.outlet, routeSnapshot.component, routeSnapshot);
            activatedRoute.snapshot = routeSnapshot;

            tab.title = routeSnapshot.data.title || 'Module';
            // TODO: Component may be a string
            tab.replaceComponent(routeSnapshot.component as Type<any>, [{
              // Provide our custom ActivatedRoute with the params
              provide: ActivatedRoute,
              useValue: activatedRoute,
            }]);

            // Since we are intercepting routing, make sure we don't leave the workspace
            this.router.navigateByUrl(this.workspaceUrl, {replaceUrl: true});

            // Update everything
            this.emitEvents();
          }
        }
      });
  }

  openTabByUrl(pane: Pane | string, url: string | UrlTree, extras?: NavigationExtras): Promise<boolean> {
    if (typeof pane === 'string') {
      pane = this.panes.getOrCreate(pane);
    }
    this.focusedPane = pane;
    pane.createTab();
    return this.navigateByUrl(url, extras);
  }

  navigateByUrl(url: string | UrlTree, extras?: NavigationExtras): Promise<boolean> {
    this.interceptNextRoute = true;
    return this.router.navigateByUrl(url, extras);
  }

  emitEvents(): void {
    this.panes$.next(this.buildPanesSnapshot());
  }

  private buildPanesSnapshot(): Pane[] {
    return this.panes.panes;
  }

  private getDeepestChild(snapshot: ActivatedRouteSnapshot) {
    if (snapshot.children.length) {
      return this.getDeepestChild(snapshot.children[0]);
    } else {
      return snapshot;
    }
  }

  moveTab(from: Pane, fromIndex: number, to: Pane, toIndex: number) {
    if (from === to) {
      moveItemInArray(from.tabs, fromIndex, toIndex);
    } else {
      const tab = from.tabs[fromIndex];
      transferArrayItem(from.tabs, to.tabs, fromIndex, toIndex);
      from.handleTabMoveFrom(tab);
      to.handleTabMoveTo(tab);
    }
    this.emitEvents();
  }
}
