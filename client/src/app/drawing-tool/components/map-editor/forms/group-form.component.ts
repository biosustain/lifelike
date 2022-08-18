import { Component, EventEmitter, Input, Output } from '@angular/core';

import { cloneDeep } from 'lodash-es';

import { WorkspaceManager } from 'app/shared/workspace-manager';
import { InternalSearchService } from 'app/shared/services/internal-search.service';
import { UniversalGraphGroup } from 'app/drawing-tool/services/interfaces';
import { RecursivePartial } from 'app/shared/utils/types';

import { EntityForm } from './entity-form';


@Component({
  selector: 'app-group-form',
  styleUrls: ['./entity-form.component.scss'],
  templateUrl: './group-form.component.html'
})
export class GroupFormComponent extends EntityForm  {


  originalGroup: UniversalGraphGroup;
  updatedGroup: UniversalGraphGroup;

  @Output() save = new EventEmitter<{
    originalData: RecursivePartial<UniversalGraphGroup>,
    updatedData: RecursivePartial<UniversalGraphGroup>,
  }>();

  constructor(protected readonly workspaceManager: WorkspaceManager,
              protected readonly internalSearch: InternalSearchService) {
    super(workspaceManager);
  }

  get hyperlinks() {
    return this.group.data?.hyperlinks ?? [];
  }

  get group() {
    return this.updatedGroup;
  }

  @Input()
  set group(group) {
    this.originalGroup = cloneDeep(group);
    this.originalGroup.style = this.originalGroup.style || {};

    this.updatedGroup = cloneDeep(group);
    this.updatedGroup.data.sources = this.updatedGroup.data.sources || [];
    this.updatedGroup.data.hyperlinks = this.updatedGroup.data.hyperlinks || [];
    this.updatedGroup.style = this.updatedGroup.style || {};
  }

  doSave() {
    this.save.next({
      originalData: {
        data: {
          sources: this.originalGroup.data.sources,
          hyperlinks: this.originalGroup.data.hyperlinks,
          detail: this.originalGroup.data.detail,
          subtype: this.originalGroup.data.subtype,
        },
        display_name: this.originalGroup.display_name,
        label: this.originalGroup.label,
        style: {
          fontSizeScale: this.originalGroup.style.fontSizeScale,
          fillColor: this.originalGroup.style.fillColor,
          strokeColor: this.originalGroup.style.strokeColor,
          bgColor: this.originalGroup.style.bgColor,
          lineType: this.originalGroup.style.lineType,
          lineWidthScale: this.originalGroup.style.lineWidthScale,
          showDetail: this.originalGroup.style.showDetail,
        },
        margin: this.originalGroup.margin
      },
      updatedData: {
        data: {
          sources: this.updatedGroup.data.sources,
          hyperlinks: this.updatedGroup.data.hyperlinks,
          detail: this.updatedGroup.data.detail,
          subtype: this.updatedGroup.data.subtype,
        },
        display_name: this.updatedGroup.display_name,
        label: this.updatedGroup.label,
        style: {
          fontSizeScale: this.updatedGroup.style.fontSizeScale,
          fillColor: this.updatedGroup.style.fillColor,
          strokeColor: this.updatedGroup.style.strokeColor,
          bgColor: this.updatedGroup.style.bgColor,
          lineType: this.updatedGroup.style.lineType,
          lineWidthScale: this.updatedGroup.style.lineWidthScale,
          showDetail: this.updatedGroup.style.showDetail,
        },
        margin: this.updatedGroup.margin
      },
    });
    this.originalGroup = cloneDeep(this.updatedGroup);
  }


  // TODO: Refactor it into its own component?
  updateMargin(event: Event) {
    this.updatedGroup.margin = +(event.target as HTMLInputElement).value;
    this.doSave();
  }

  // TODO: Search related stuff?



}
