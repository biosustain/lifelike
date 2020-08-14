import { Component, Input, OnInit, OnDestroy, NgZone, ViewChild } from '@angular/core';
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
import { Project } from 'app/file-browser/services/project-space.service';
import { Subscription } from 'rxjs';
import { MapService } from '../services/map.service';
import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';
import { KnowledgeMapStyle } from 'app/graph-viewer/styles/knowledge-map-style';

@Component({
  selector: 'app-map-version-dialog',
  templateUrl: './map-version-dialog.component.html',
    styleUrls: [
    './map-version-dialog.component.scss',
  ],
})
export class MapVersionDialogComponent extends CommonFormDialogComponent implements OnInit, OnDestroy{
  @Input() currentMap: KnowledgeMap;
  @Input() projectName: string;

  @ViewChild('canvas', {static: true}) canvasChild;


  readonly form: FormGroup = new FormGroup({
    version: new FormControl('', Validators.required),
  });
  
  public readonly loadTask: BackgroundTask<
    void,
    {versions: KnowledgeMap[]}
  > = new BackgroundTask(() => this.mapService.getMapVersions(this.projectName, this.currentMap.hash_id));
  private loadTaskSubscription: Subscription;
  versionChoices: string[];
  private versionMaps: KnowledgeMap[];
  mapToPreview: KnowledgeMap;
  graphCanvas: CanvasGraphView;
  isMapVisible: boolean = false;
  errorHandler: any;

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog, private readonly mapService: MapService,
    readonly ngZone: NgZone,
    ) {
    super(modal, messageDialog);
  }

  ngOnInit() {
    this.loadTaskSubscription = this.loadTask.results$.subscribe(
      ({ result: versions}) => {
        this.versionChoices = versions.versions.map((version) => 'Date Modified: ' + version.date_modified);
        this.versionChoices.unshift('');
        this.versionMaps = versions.versions.map((version) => version);
      }
    );
    this.loadTask.update();
    const style = new KnowledgeMapStyle();
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

  preview(){
    this.isMapVisible = true;
    console.log(this.isMapVisible);
    
    this.mapToPreview = this.findMap();
    this.graphCanvas.setGraph(this.mapToPreview.graph);
    this.graphCanvas.zoomToFit(0);
  }

  getValue(): KnowledgeMap {
    return this.findMap();
  }
  
  findMap(): KnowledgeMap {
    const date = this.form.value.version.substring(15);
    return this.versionMaps.filter((version) => version.date_modified == date)[0];
  }
}
