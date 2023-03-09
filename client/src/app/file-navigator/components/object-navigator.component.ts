import { Component, EventEmitter, Output } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { escapeRegExp } from "lodash-es";
import { defer, of, Subscription } from "rxjs";

import { EnrichmentTableViewerComponent } from "app/enrichment/components/table/enrichment-table-viewer.component";
import { ENRICHMENT_TABLE_MIMETYPE } from "app/file-types/providers/enrichment-table.type-provider";
import { FilesystemObject } from "app/file-browser/models/filesystem-object";
import { FilesystemService } from "app/file-browser/services/filesystem.service";
import { WordCloudAnnotationFilterEntity } from "app/interfaces/annotation-filter.interface";
import { PdfViewComponent } from "app/pdf-viewer/components/pdf-view.component";
import { ModuleAwareComponent, ModuleProperties } from "app/shared/modules";
import { BackgroundTask } from "app/shared/rxjs/background-task";
import { WorkspaceManager } from "app/shared/workspace-manager";
import { MimeTypes } from "app/shared/constants";
import { ModuleContext } from "app/shared/services/module-context.service";

@Component({
  selector: "app-object-navigator",
  templateUrl: "./object-navigator.component.html",
  providers: [ModuleContext],
})
export class ObjectNavigatorComponent implements ModuleAwareComponent {
  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  loadTask: BackgroundTask<string, FilesystemObject>;
  fileLoadedSub: Subscription;

  object: FilesystemObject;
  sourceData$ = defer(() => of(this.object.getGraphEntitySources()));

  constructor(
    protected readonly route: ActivatedRoute,
    protected readonly filesystemService: FilesystemService,
    protected readonly workspaceManager: WorkspaceManager,
    protected readonly moduleContext: ModuleContext
  ) {
    moduleContext.register(this);

    this.loadTask = new BackgroundTask((hashId) => this.filesystemService.get(hashId));

    this.fileLoadedSub = this.loadTask.results$.subscribe(({ result: object, value: [] }) => {
      this.object = object;
      this.modulePropertiesChange.emit({
        title: object.effectiveName,
        fontAwesomeIcon: "fas fa-compass",
      });
    });

    this.loadTask.update(this.route.snapshot.params.file_id);
  }

  openWord(annotation: WordCloudAnnotationFilterEntity, useKeyword: boolean) {
    if (this.object.mimeType === MimeTypes.Pdf) {
      const url = this.object.getURL();
      const matchExistingTab = `^/*${escapeRegExp(url.toString())}.*`;
      url.fragment = new URLSearchParams({ annotation: annotation.id }).toString();
      this.workspaceManager.navigateByUrl({
        url: url.toString(),
        extras: {
          newTab: true,
          sideBySide: true,
          matchExistingTab,
          shouldReplaceTab: (component) => {
            const fileViewComponent = component as PdfViewComponent;
            fileViewComponent.highlightAnnotation(annotation.id);
            return false;
          },
        },
      });
    } else if (this.object.mimeType === ENRICHMENT_TABLE_MIMETYPE) {
      const url = this.object.getURL();
      const matchExistingTab = `^/*${escapeRegExp(url.toString())}.*`;
      const encodedId = encodeURIComponent(annotation.id);
      const encodedText = encodeURIComponent(annotation.text);
      const encodedColor = encodeURIComponent(annotation.color);
      this.workspaceManager.navigateByUrl({
        url: `${url}#id=${encodedId}&text=${encodedText}&color=${encodedColor}`,
        extras: {
          newTab: true,
          sideBySide: true,
          matchExistingTab,
          shouldReplaceTab: (component) => {
            const enrichmentTableViewerComponent = component as EnrichmentTableViewerComponent;
            enrichmentTableViewerComponent.startAnnotationFind(
              annotation.id,
              annotation.text,
              annotation.color
            );
            return false;
          },
        },
      });
    } else {
      this.workspaceManager.navigate(["/search", "content"], {
        queryParams: {
          q: `"${useKeyword ? annotation.text : annotation.primaryName}"`,
          folders: this.object.hashId,
          types: "pdf",
        },
        newTab: true,
        sideBySide: true,
      });
    }
  }
}
