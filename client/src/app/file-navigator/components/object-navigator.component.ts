import { Component, EventEmitter, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { combineLatest, Subscription } from 'rxjs';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { FilesystemObject} from '../../file-browser/models/filesystem-object';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { WordCloudAnnotationFilterEntity } from '../../interfaces/annotation-filter.interface';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { escapeRegExp } from 'lodash';
import { FileViewComponent } from '../../pdf-viewer/components/file-view.component';
import { ModuleAwareComponent, ModuleProperties } from '../../shared/modules';
import { PDF_MIMETYPE } from '../../pdf-viewer/providers/pdf-type-provider';

@Component({
  selector: 'app-object-navigator',
  templateUrl: './object-navigator.component.html',
})
export class ObjectNavigatorComponent implements ModuleAwareComponent {

  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  loadTask: BackgroundTask<string, [FilesystemObject]>;
  fileLoadedSub: Subscription;

  object: FilesystemObject;

  constructor(protected readonly route: ActivatedRoute,
              protected readonly filesystemService: FilesystemService,
              protected readonly workspaceManager: WorkspaceManager) {

    this.loadTask = new BackgroundTask(hashId => {
      return combineLatest(
        this.filesystemService.get(hashId),
      );
    });

    this.fileLoadedSub = this.loadTask.results$.subscribe(({
                                                             result: [object],
                                                             value: [],
                                                           }) => {
      this.object = object;
      this.modulePropertiesChange.emit({
        title: object.effectiveName,
        fontAwesomeIcon: 'fas fa-compass',
      });
    });

    this.loadTask.update(this.route.snapshot.params.file_id);
  }

  openWord(annotation: WordCloudAnnotationFilterEntity) {
    if (this.object.mimeType === PDF_MIMETYPE) {
      const url = this.object.getURL();
      this.workspaceManager.navigateByUrl(
        `${url}#annotation=${encodeURIComponent(annotation.id)}`, {
          newTab: true,
          sideBySide: true,
          matchExistingTab: `^/*${escapeRegExp(url)}.*`,
          shouldReplaceTab: component => {
            const fileViewComponent = component as FileViewComponent;
            fileViewComponent.highlightAnnotation(annotation.id);
            return false;
          },
        },
      );
    } else {
      this.workspaceManager.navigate(
        ['/search', 'content'], {
          queryParams: {
            q: annotation.text,
          },
          newTab: true,
          sideBySide: true,
        },
      );
    }
  }
}
