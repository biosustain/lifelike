import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { combineLatest, Subscription } from 'rxjs';
import { UniversalGraphNode } from '../../drawing-tool/services/interfaces';

import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { mapBlobToBuffer, mapBufferToJson } from 'app/shared/utils/files';

@Component({
  selector: 'app-sankey-viewer',
  templateUrl: './sankey-view.component.html',
  styleUrls: ['./sankey-view.component.scss'],
})
export class SankeyViewComponent implements OnDestroy, ModuleAwareComponent {
  @Output() requestClose: EventEmitter<any> = new EventEmitter();

  paramsSubscription: Subscription;
  returnUrl: string;

  loadTask: any;
  openSankeySub: Subscription;
  ready = false;
  object?: FilesystemObject;
  // Type information coming from interface sankeySource at:
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/sankeyjs-dist/index.d.ts
  sankeyData: Array<Document>;
  sankeyFileLoaded = false;
  modulePropertiesChange = new EventEmitter<ModuleProperties>();
  private currentFileId: any;

  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly route: ActivatedRoute
  ) {
    this.loadTask = new BackgroundTask(([hashId]) => {
      return combineLatest(
        this.filesystemService.get(hashId),
        this.filesystemService.getContent(hashId).pipe(
          mapBlobToBuffer(),
          mapBufferToJson()
        )
      );
    });

    this.paramsSubscription = this.route.queryParams.subscribe(params => {
      this.returnUrl = params.return;
    });

    // Listener for file open
    this.openSankeySub = this.loadTask.results$.subscribe(({
                                                             result: [object, content],
                                                           }) => {

      this.sankeyData = content;
      this.object = object;
      this.emitModuleProperties();

      this.currentFileId = object.hashId;
      this.ready = true;
    });

    this.loadFromUrl();
  }

  loadFromUrl() {
    // Check if the component was loaded with a url to parse fileId
    // from
    if (this.route.snapshot.params.file_id) {
      this.object = null;
      this.currentFileId = null;

      const linkedFileId = this.route.snapshot.params.file_id;
      this.opensankey(linkedFileId);
    }
  }

  requestRefresh() {
    if (confirm('There have been some changes. Would you like to refresh this open document?')) {
      this.loadFromUrl();
    }
  }

  /**
   * Open sankey by file_id along with location to scroll to
   * @param hashId - represent the sankey to open
   */
  opensankey(hashId: string) {
    if (this.object != null && this.currentFileId === this.object.hashId) {
      return;
    }
    this.sankeyFileLoaded = false;
    this.ready = false;

    this.loadTask.update([hashId]);
  }

  ngOnDestroy() {
    this.paramsSubscription.unsubscribe();
    this.openSankeySub.unsubscribe();
  }


  close() {
    this.requestClose.emit(null);
  }

  emitModuleProperties() {
    this.modulePropertiesChange.next({
      title: this.object.filename,
      fontAwesomeIcon: 'file-chart-line',
    });
  }

  dragStarted(event: DragEvent) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', this.object.filename);
    dataTransfer.setData('application/lifelike-node', JSON.stringify({
      display_name: this.object.filename,
      label: 'link',
      sub_labels: [],
      data: {
        references: [{
          type: 'PROJECT_OBJECT',
          id: this.object.hashId + '',
        }],
        sources: [{
          domain: this.object.filename,
          url: ['/projects', encodeURIComponent(this.object.project.name),
            'sankey', encodeURIComponent(this.object.hashId)].join('/'),
        }],
      },
    } as Partial<UniversalGraphNode>));
  }
}
