import { Component, Input, OnInit, OnDestroy } from '@angular/core';
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

@Component({
  selector: 'app-map-version-dialog',
  templateUrl: './map-version-dialog.component.html',
})
export class MapVersionDialogComponent extends CommonFormDialogComponent implements OnInit, OnDestroy{
  @Input() currentMap: KnowledgeMap;
  @Input() projectName: string;

  readonly form: FormGroup = new FormGroup({
    version: new FormControl('', Validators.required),
  });
  
  public readonly loadTask: BackgroundTask<
    void,
    {versions: KnowledgeMap[]}
  > = new BackgroundTask(() => this.mapService.getMapVersions(this.projectName, this.currentMap.hash_id));
  private loadTaskSubscription: Subscription;
  private versionChoices: string[];
  private versionMaps: KnowledgeMap[]
  errorHandler: any;

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog, private readonly mapService: MapService
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

  getValue(): KnowledgeMap {
    const date = this.form.value.version.substring(15);
    return this.versionMaps.filter((version) => version.date_modified == date)[0];
  }
}
