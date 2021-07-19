import { Component, EventEmitter, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Subscription } from 'rxjs';

import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { SessionStorageService } from '../../shared/services/session-storage.service';
import { getTraceDetailsGraph } from './traceDetails';

@Component({
  selector: 'app-sankey-viewer',
  templateUrl: './trace-view.component.html',
  styleUrls: ['./trace-view.component.scss'],
})
export class TraceViewComponent implements OnDestroy, ModuleAwareComponent {
  paramsSubscription: Subscription;
  returnUrl: string;
  modulePropertiesChange = new EventEmitter<ModuleProperties>();

  data;
  title;
  openError;

  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly route: ActivatedRoute,
    private readonly sessionStorage: SessionStorageService
  ) {
    this.paramsSubscription = this.route.data.subscribe(params => {
      this.returnUrl = params.return;
    });
    const storageId = this.route.snapshot.params.id;
    const content = this.sessionStorage.get(storageId);
    if (content) {
      this.data = getTraceDetailsGraph(content);
      const {startNode: {label: startLabel}, endNode: {label: endLabel}} = this.data;
      this.title = `${startLabel} → ${endLabel}`;
    } else {
      this.openError = true;
      this.title = 'Outdated';
    }
    this.emitModuleProperties();
  }

  ngOnDestroy() {
    this.paramsSubscription.unsubscribe();
  }

  emitModuleProperties() {
    this.modulePropertiesChange.next({
      title: this.title,
      fontAwesomeIcon: 'file-chart-line',
    });
  }
}
