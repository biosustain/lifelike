import { Directive, HostBinding, HostListener, Input, OnChanges } from '@angular/core';
import { WorkspaceManager } from '../workspace-manager';
import { ActivatedRoute, NavigationEnd, QueryParamsHandling, Router, UrlTree } from '@angular/router';
import { Subscription } from 'rxjs';
import { LocationStrategy } from '@angular/common';

/**
 * Implements a version of [routerLink] that works with the workspace manager to load
 * routes in the current workspace.
 */
export class AbstractLinkDirective {
  @HostBinding('attr.href') @Input() href: string;
  @HostBinding('attr.target') @Input() target: string;
  @Input() queryParams: { [k: string]: any };
  @Input() fragment: string;
  @Input() queryParamsHandling: QueryParamsHandling;
  @Input() preserveFragment: boolean;
  @Input() skipLocationChange: boolean;
  @Input() replaceUrl: boolean;
  @Input() state?: { [k: string]: any };
  commands: any[] = [];

  constructor(readonly workspaceManager: WorkspaceManager,
              readonly router: Router,
              readonly route: ActivatedRoute) {
  }

  @Input()
  set appLink(commands: any[] | string | null | undefined) {
    if (commands != null) {
      this.commands = Array.isArray(commands) ? commands : [commands];
    } else {
      this.commands = [];
    }
  }

  @HostListener('click', ['$event.button', '$event.ctrlKey', '$event.metaKey', '$event.shiftKey'])
  onClick(button: number, ctrlKey: boolean, metaKey: boolean, shiftKey: boolean): boolean {
    if (button !== 0 || ctrlKey || metaKey || shiftKey) {
      return true;
    }

    if (typeof this.target === 'string' && this.target !== '_self') {
      return true;
    }

    const extras = {
      skipLocationChange: attrBoolValue(this.skipLocationChange),
      replaceUrl: attrBoolValue(this.replaceUrl),
      state: this.state,
    };
    this.workspaceManager.navigateByUrl(this.urlTree, extras);

    return false;
  }

  get urlTree(): UrlTree {
    return this.router.createUrlTree(this.commands, {
      relativeTo: this.route,
      queryParams: this.queryParams,
      fragment: this.fragment,
      queryParamsHandling: this.queryParamsHandling,
      preserveFragment: attrBoolValue(this.preserveFragment),
    });
  }

}

@Directive({
  selector: ':not(a):not(area)[appLink]',
})
export class LinkWithoutHrefDirective extends AbstractLinkDirective {
  constructor(workspaceManager: WorkspaceManager, router: Router, route: ActivatedRoute) {
    super(workspaceManager, router, route);
  }
}

@Directive({
  selector: 'a[appLink],area[appLink]',
})
export class LinkWithHrefDirective extends AbstractLinkDirective implements OnChanges {
  @HostBinding() href: string;

  private subscription: Subscription;

  constructor(workspaceManager: WorkspaceManager,
              router: Router,
              route: ActivatedRoute,
              private locationStrategy: LocationStrategy) {
    super(workspaceManager, router, route);
    this.subscription = router.events.subscribe(s => {
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
  return s === '' || !!s;
}
