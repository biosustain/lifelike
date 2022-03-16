import { Component } from '@angular/core';

import { WorkspaceManager } from 'app/shared/workspace-manager';
import { InternalSearchService } from 'app/shared/services/internal-search.service';

import { NodeFormComponent } from './node-form.component';
import { NodeGroup } from '../../services/interfaces';
import { LINE_TYPES } from '../../services/line-types';
import { BG_PALETTE_COLORS, PALETTE_COLORS } from '../../services/palette';

@Component({
  selector: 'app-group-form',
  templateUrl: './group-form.component.html'
})
export class GroupFormComponent extends NodeFormComponent {

  originalGroup: NodeGroup;
  updatedGroup: NodeGroup;
   lineTypeChoices = [
    [null, {
      name: '(Default)',
    }],
    ...LINE_TYPES.entries(),
  ];
  paletteChoices = [...PALETTE_COLORS];
  bgPaletteChoices = [...BG_PALETTE_COLORS];
  private ASSUMED_PANEL_HEIGHT = 450;



  constructor(protected readonly workspaceManager: WorkspaceManager,
              protected readonly internalSearch: InternalSearchService) {
    super(workspaceManager, internalSearch);
  }


}
