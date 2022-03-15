import { Component } from '@angular/core';

import { WorkspaceManager } from 'app/shared/workspace-manager';
import { InternalSearchService } from 'app/shared/services/internal-search.service';

import { NodeFormComponent } from './node-form.component';

@Component({
  selector: 'app-group-form',
  templateUrl: './group-form.component.html'
})
export class GroupFormComponent extends NodeFormComponent {

  constructor(protected readonly workspaceManager: WorkspaceManager,
              protected readonly internalSearch: InternalSearchService) {
    super(workspaceManager, internalSearch);
  }


}
