import { Directive, HostBinding, HostListener, Input } from '@angular/core';
import { WorkspaceManager } from '../workspace-manager';

/**
 * Implements a version of [routerLink] that works with the workspace manager to load
 * routes in the current workspace.
 */
@Directive({
  selector: '[appLink]',
})
export class LinkDirective {
  @Input() appLink: string;
  @HostBinding('attr.target') @Input() target: string;

  constructor(private readonly workspaceManager: WorkspaceManager) {
  }

  @HostListener('click', ['$event.button', '$event.ctrlKey', '$event.metaKey', '$event.shiftKey'])
  onClick(button: number, ctrlKey: boolean, metaKey: boolean, shiftKey: boolean): boolean {
    if (button !== 0 || ctrlKey || metaKey || shiftKey) {
      return true;
    }

    if (typeof this.target === 'string' && this.target !== '_self') {
      return true;
    }

    this.workspaceManager.navigateByUrl(this.appLink);

    return false;
  }
}
