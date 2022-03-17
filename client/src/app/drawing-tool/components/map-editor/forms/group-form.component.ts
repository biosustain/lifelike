import { Component, Input } from '@angular/core';

import { cloneDeep } from 'lodash-es';

import { WorkspaceManager } from 'app/shared/workspace-manager';
import { InternalSearchService } from 'app/shared/services/internal-search.service';
import { NodeGroup, UniversalGraphEntity } from 'app/drawing-tool/services/interfaces';
import { LINE_TYPES } from 'app/drawing-tool/services/line-types';

import { NodeFormComponent } from './node-form.component';


@Component({
  selector: 'app-group-form',
  templateUrl: './group-form.component.html'
})
export class GroupFormComponent  {

   lineTypeChoices = [
    [null, {
      name: '(Default)',
    }],
    ...LINE_TYPES.entries(),
  ];

  constructor(protected readonly workspaceManager: WorkspaceManager,
              protected readonly internalSearch: InternalSearchService) {
  }

  // get group() {
  //   return this.updatedNode;
  // }
  //
  // @Input()
  // set group(group: UniversalGraphEntity) {
  //   group = group as NodeGroup;
  //   this.previousLabel = group.label;
  //
  //   this.originalNode = cloneDeep(group);
  //   this.originalNode.style = this.originalNode.style || {};
  //
  //
  //   this.updatedNode = cloneDeep(group);
  //   this.updatedNode.data.sources = this.updatedNode.data.sources || [];
  //   this.updatedNode.data.hyperlinks = this.updatedNode.data.hyperlinks || [];
  //   this.updatedNode.style = this.updatedNode.style || {};
  // }



}
