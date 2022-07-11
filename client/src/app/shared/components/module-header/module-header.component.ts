import { Component, Input, EventEmitter, Output, TemplateRef, OnChanges, SimpleChanges } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { get } from 'lodash-es';
import { Observable, ReplaySubject } from 'rxjs';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { ViewService } from 'app/file-browser/services/view.service';
import { Source, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';

import { WorkspaceManager } from '../../workspace-manager';
import { ModuleContext } from '../../services/module-context.service';
import { CdkNativeDragItegration } from '../../utils/drag';

@Component({
  selector: 'app-module-header',
  templateUrl: './module-header.component.html'
})
export class ModuleHeaderComponent implements OnChanges {
  @Input() object!: FilesystemObject;
  @Input() titleTemplate: TemplateRef<any>;
  @Input() returnUrl: string;
  @Input() showObjectMenu = true;
  @Input() showBreadCrumbs = true;
  @Input() showNewWindowButton = true;
  @Input() dragTitleData$: Observable<Record<string, string>>;
  drag: CdkNativeDragItegration;

  constructor(
    private tabUrlService: ModuleContext
  ) {
  }

  ngOnChanges({dragTitleData$}: SimpleChanges) {
    if (dragTitleData$) {
      this.drag = dragTitleData$.currentValue && new CdkNativeDragItegration(dragTitleData$.currentValue);
    }
  }

  openNewWindow() {
    return this.tabUrlService.shareableLink.then(href => window.open(href));
  }
}
