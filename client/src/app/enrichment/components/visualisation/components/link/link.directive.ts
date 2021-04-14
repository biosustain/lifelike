import { Directive, Input, HostBinding } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { LinkWithoutHrefDirective } from 'app/shared/directives/link.directive';
import { map } from 'rxjs/operators';

export const paramsToEnrichmentTableLink = ({project_name, file_id}) => ({
  appLink: [
    '/projects',
    project_name,
    'enrichment-table',
    file_id
  ],
  matchExistingTab: '^/+projects/[^/]+/enrichment-table/' +
    file_id +
    '([?#].*)?'
});

/**
 * Implements a version of [LinkWithoutHrefDirective] that automatically resolves path to related
 * enrichment table.
 */
@Directive({
  selector: ':not(a):not(area)[appSELink]'
})
export class SELinkDirective extends LinkWithoutHrefDirective {
  @HostBinding('style.cursor') cursor = 'pointer';

  constructor(workspaceManager: WorkspaceManager, router: Router, route: ActivatedRoute) {
    super(workspaceManager, router, route);
    route.params.pipe(
      map(paramsToEnrichmentTableLink)
    ).subscribe(
      link => Object.assign(this, link)
    );
  }

  @Input() appSELink;
  sideBySide = true;
  newTab = true;

  appLink;
  matchExistingTab;

  get fragment() {
    return this.appSELink;
  }
}
