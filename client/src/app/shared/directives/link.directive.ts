import { Directive, HostBinding, HostListener, Input, OnChanges } from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  NavigationExtras,
  QueryParamsHandling,
  Router,
  UrlTree,
} from '@angular/router';
import { LocationStrategy } from '@angular/common';

import { Subscription } from 'rxjs';

import { openInternalLink, toValidUrl } from '../utils/browser';
import { assignDefined } from '../utils/types';
import { WorkspaceManager, WorkspaceNavigationExtras } from '../workspace-manager';

/**
 * Implements a version of [routerLink] that works with the workspace manager to load
 * routes in the current workspace.
 */
@Directive({
  selector: "[appAbstractLinkDirective]",
})
export class AbstractLinkDirective {
  @HostBinding("attr.href") @Input() href: string;
  @HostBinding("attr.target") @Input() target: string;
  @Input() queryParams: { [k: string]: any };
  @Input() fragment: string;
  @Input() queryParamsHandling: QueryParamsHandling;
  @Input() preserveFragment: boolean;
  @Input() skipLocationChange: boolean;
  @Input() replaceUrl: boolean;
  @Input() state?: { [k: string]: any };
  @Input() newTab: boolean;
  @Input() sideBySide: boolean;
  @Input() keepFocus: boolean;
  @Input() matchExistingTab: string | RegExp;
  @Input() shouldReplaceTab: (component: any) => boolean;
  @Input() handleClick = true; // TODO: Really should refactor this out, it's only used as a sort of kludge in one place
  @Input() forceWorkbench = false;
  @Input() preferPane: string;
  @Input() preferStartupPane: string;
  @Input() openParentFirst: boolean;
  commands: any[] = [];
  parentCommands: any[] = [];

  @Input()
  set appLink(commands: any[] | string | null | undefined) {
    if (commands != null) {
      this.commands = Array.isArray(commands) ? commands : [commands];
    } else {
      this.commands = [];
    }
  }

  @Input()
  set parentAddress(commands: any[] | string | null | undefined) {
    if (commands != null) {
      this.parentCommands = Array.isArray(commands) ? commands : [commands];
    } else {
      this.parentCommands = [];
    }
  }

  get urlTree(): UrlTree {
    // Only keep defined properties. For example, `this.fragment` is often undefined, and including it can produce undesired URLs.
    const navExtras: NavigationExtras = assignDefined(
      {},
      {
        relativeTo: this.route,
        queryParams: this.queryParams,
        queryParamsHandling: this.queryParamsHandling,
        preserveFragment: attrBoolValue(this.preserveFragment),
        fragment: this.fragment,
      }
    );

    return this.router.createUrlTree(this.commands, navExtras);
  }

  constructor(
    readonly workspaceManager: WorkspaceManager,
    readonly router: Router,
    readonly route: ActivatedRoute
  ) {}

  @HostListener("click", ["$event.button", "$event.ctrlKey", "$event.metaKey", "$event.shiftKey"])
  onClick(button: number, ctrlKey: boolean, metaKey: boolean, shiftKey: boolean): boolean {
    if (!this.handleClick) {
      return true;
    }

    if (button !== 0 || ctrlKey || metaKey || shiftKey) {
      return true;
    }

    if (typeof this.target === "string" && this.target !== "_self") {
      return true;
    }

    // Create an object with only the properties which are defined. Avoids including unused properties, which is particular useful when
    // expanding the object.
    const extras: WorkspaceNavigationExtras = assignDefined(
      {},
      {
        skipLocationChange: attrBoolValue(this.skipLocationChange),
        replaceUrl: attrBoolValue(this.replaceUrl),
        state: this.state,
        newTab: attrBoolValue(this.newTab),
        sideBySide: attrBoolValue(this.sideBySide),
        keepFocus: attrBoolValue(this.keepFocus),
        matchExistingTab: this.matchExistingTab,
        forceWorkbench: attrBoolValue(this.forceWorkbench),
        preferPane: this.preferPane,
        preferStartupPane: this.preferStartupPane,
        shouldReplaceTab: this.shouldReplaceTab,
        openParentFirst: attrBoolValue(this.openParentFirst),
        parentAddress: this.router.createUrlTree(this.parentCommands),
      }
    );

    openInternalLink(this.workspaceManager, toValidUrl(this.urlTree.toString()), extras);
    return false;
  }
}

@Directive({
  selector: ":not(a):not(area)[appLink]",
})
export class LinkWithoutHrefDirective extends AbstractLinkDirective {
  constructor(workspaceManager: WorkspaceManager, router: Router, route: ActivatedRoute) {
    super(workspaceManager, router, route);
  }
}

@Directive({
  selector: "a[appLink],area[appLink]",
})
export class LinkWithHrefDirective extends AbstractLinkDirective implements OnChanges {
  @HostBinding() href: string;

  private subscription: Subscription;

  constructor(
    workspaceManager: WorkspaceManager,
    router: Router,
    route: ActivatedRoute,
    private locationStrategy: LocationStrategy
  ) {
    super(workspaceManager, router, route);
    this.subscription = router.events.subscribe((s) => {
      if (s instanceof NavigationEnd) {
        this.updateTargetUrlAndHref();
      }
    });
  }

  ngOnChanges() {
    this.updateTargetUrlAndHref();
  }

  private updateTargetUrlAndHref(): void {
    this.href = this.locationStrategy.prepareExternalUrl(this.router.serializeUrl(this.urlTree));
  }
}

function attrBoolValue(s: any): boolean {
  return s === "" || !!s;
}
