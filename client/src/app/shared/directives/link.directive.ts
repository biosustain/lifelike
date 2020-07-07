import { Directive, HostBinding, HostListener, Input } from '@angular/core';
import { WorkspaceManager } from '../workspace-manager';
import { ActivatedRoute, QueryParamsHandling, Router, UrlTree } from '@angular/router';

/**
 * Implements a version of [routerLink] that works with the workspace manager to load
 * routes in the current workspace.
 */
@Directive({
  selector: '[appLink]',
})
export class LinkDirective {
  @HostBinding('attr.target') @Input() target: string;
  @Input() queryParams: { [k: string]: any };
  @Input() fragment: string;
  @Input() queryParamsHandling: QueryParamsHandling;
  @Input() preserveFragment: boolean;
  @Input() skipLocationChange: boolean;
  @Input() replaceUrl: boolean;
  @Input() state?: { [k: string]: any };
  private commands: any[] = [];

  constructor(private readonly workspaceManager: WorkspaceManager,
              private router: Router,
              private route: ActivatedRoute) {
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

function attrBoolValue(s: any): boolean {
  return s === '' || !!s;
}
