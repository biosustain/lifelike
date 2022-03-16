import { Component, Input } from '@angular/core';

import { cloneDeep } from 'lodash-es';

import { WorkspaceManager } from 'app/shared/workspace-manager';
import { InternalSearchService } from 'app/shared/services/internal-search.service';

import { NodeFormComponent } from './node-form.component';
import { GraphEntity, NodeGroup, UniversalGraphEntity } from '../../services/interfaces';
import { LINE_TYPES } from '../../services/line-types';
import { BG_PALETTE_COLORS, PALETTE_COLORS } from '../../services/palette';

@Component({
  selector: 'app-group-form',
  templateUrl: './group-form.component.html'
})
export class GroupFormComponent extends NodeFormComponent {

   lineTypeChoices = [
    [null, {
      name: '(Default)',
    }],
    ...LINE_TYPES.entries(),
  ];

  constructor(protected readonly workspaceManager: WorkspaceManager,
              protected readonly internalSearch: InternalSearchService) {
    super(workspaceManager, internalSearch);
  }

  get group() {
    return this.updatedNode;
  }

  @Input()
  set group(group: UniversalGraphEntity) {
    group = group as NodeGroup;
    this.previousLabel = group.label;

    this.originalNode = cloneDeep(group);
    this.originalNode.style = this.originalNode.style || {};


    this.updatedNode = cloneDeep(group);
    this.updatedNode.data.sources = this.updatedNode.data.sources || [];
    this.updatedNode.data.hyperlinks = this.updatedNode.data.hyperlinks || [];
    this.updatedNode.style = this.updatedNode.style || {};
  }



}
