import { Component, Input, OnInit, OnDestroy, NgZone, ViewChild, AfterViewInit } from '@angular/core';
import {
  FormGroup, FormControl, Validators
} from '@angular/forms';
import {
  KnowledgeMap
} from '../services/interfaces';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonFormDialogComponent } from '../../shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { Subscription, Observable } from 'rxjs';

import { MapService } from '../services/map.service';
import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';
import { KnowledgeMapStyle } from 'app/graph-viewer/styles/knowledge-map-style';
import { DelegateResourceManager } from '../../graph-viewer/utils/resource/resource-manager';
import { MapImageProviderService } from '../services/map-image-provider.service';

@Component({
  selector: 'app-map-version-dialog',
  templateUrl: './map-version-dialog.component.html',
    styleUrls: [
    './map-version-dialog.component.scss',
  ],
})
export class MapVersionDialogComponent extends CommonFormDialogComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() currentMap: KnowledgeMap;
  @Input() projectName: string;

  @ViewChild('canvas', {static: true}) canvasChild;


  readonly form: FormGroup = new FormGroup({
    version: new FormControl('', Validators.required),
  });

  public readonly loadTask: BackgroundTask<
    void,
    {versions: KnowledgeMap[]}
  > = new BackgroundTask(() => MapService.getMapVersions(this.projectName, this.currentMap.hash_id));
  private loadTaskSubscription: Subscription;
  versionChoices: string[];
  versionIDs: number[];
  mapToPreview: KnowledgeMap;
  graphCanvas: CanvasGraphView;
  isMapVisible = false;
  errorHandler: any;

  constructor(
    modal: NgbActiveModal,
    messageDialog: MessageDialog,
    // private readonly mapService: MapService,
    readonly ngZone: NgZone,
    readonly mapImageProviderService: MapImageProviderService,
  ) {
    super(modal, messageDialog);
  }

  ngOnInit() {
    this.loadTaskSubscription = this.loadTask.results$.subscribe(
      ({ result: versions}) => {
        this.versionIDs = versions.versions.map((version) => (version.id as number));
        this.versionChoices = versions.versions.reverse().map(
          (version) => 'Version ' + (this.versionIDs.indexOf(version.id as number) + 1) + '. Date Modified: ' + version.modified_date);
        this.versionChoices.unshift('');
      }
    );
    this.loadTask.update();
  }

  ngAfterViewInit() {
    const style = new KnowledgeMapStyle(new DelegateResourceManager(this.mapImageProviderService));
    this.graphCanvas = new CanvasGraphView(this.canvasChild.nativeElement as HTMLCanvasElement, {
      nodeRenderStyle: style,
      edgeRenderStyle: style,
    });
    this.graphCanvas.startParentFillResizeListener();
    this.ngZone.runOutsideAngular(() => {
        this.graphCanvas.startAnimationLoop();
    });
  }

  ngOnDestroy() {
    this.loadTaskSubscription.unsubscribe();
  }

  get map() {
    return this.currentMap;
  }

  @Input()
  set map(value: KnowledgeMap) {
    this.currentMap = value;
    this.form.setValue({
      version: this.form.value.version || '',
    });
  }

  preview() {
    this.findVersion().subscribe(result => {
      this.mapToPreview = result.version;
      this.graphCanvas.setGraph(this.mapToPreview.graph);
      this.graphCanvas.zoomToFit(0);
    });
  }

  getValue(): Observable<{version: KnowledgeMap}> {
    return this.findVersion();
  }

  findVersion() {
    const versionId = this.versionIDs[this.form.value.version.split('.')[0].substring(8) - 1];
    return MapService.getMapVersionbyID(this.projectName, this.currentMap.hash_id, versionId);
  }
}
