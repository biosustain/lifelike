import { Directive, Input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { LinkWithoutHrefDirective } from 'app/shared/directives/link.directive';

/**
 * Implements a version of [LinkWithoutHrefDirective] that automatically resolves path to related
 * enrichment table.
 */
@Directive({
  selector: ':not(a):not(area)[appSELink]',
  host: {
    '[style.cursor]': '"pointer"',
  }
})
export class SELinkDirective extends LinkWithoutHrefDirective {
  constructor(workspaceManager: WorkspaceManager, router: Router, route: ActivatedRoute) {
    super(workspaceManager, router, route);
    route.params.subscribe(({project_name, file_id}) => {
        this.appLink = [
          '/projects',
          project_name,
          'enrichment-table',
          file_id
        ];
        this.matchExistingTab = '^/+projects/[^/]+/enrichment-table/' +
          file_id +
          '([?#].*)?';
      }
    );
  }

  @Input() appSELink;
  sideBySide = true;
  newTab = true;
  preferPane = 'left';

  appLink;
  matchExistingTab;

  get fragment() {
    return this.appSELink;
  }
}
