import {
  Component,
  ContentChild,
  Input,
  OnChanges,
  SimpleChanges,
  TemplateRef,
} from '@angular/core';

import { defer, iif, Observable, ReplaySubject, Subject } from 'rxjs';
import { map, mergeMap, shareReplay, switchMap } from 'rxjs/operators';
import { partition } from 'lodash/fp';

import { Exporter } from 'app/file-types/providers/base-object.type-provider';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { ObjectExportDialogValue } from 'app/file-browser/components/dialog/object-export-dialog.component';
import { getObjectLabel } from 'app/file-browser/utils/objects';

import { ErrorHandler } from '../../services/error-handler.service';

@Component({
  selector: 'app-exporters-ref',
  templateUrl: './exporters-ref.component.html',
})
export class ExportersRefComponent implements OnChanges {
  constructor(
    protected readonly errorHandler: ErrorHandler,
    protected readonly actions: FilesystemObjectActions,
    protected readonly objectTypeService: ObjectTypeService,
  ) {

  }

  @ContentChild(TemplateRef) buttonTemplate: TemplateRef<any>;

  @Input() object: FilesystemObject;
  private readonly object$: Subject<FilesystemObject> = new ReplaySubject(1);
  private readonly exporters$: Observable<Exporter[]> = this.object$.pipe(
    this.errorHandler.create({label: 'Get exporters'}),
    switchMap((object) =>
      iif(
        () => Boolean(object),
        defer(() => this.objectTypeService.get(object).pipe(shareReplay())),
        defer(() => this.objectTypeService.getDefault()),
      ).pipe(
        mergeMap(typeProvider => typeProvider.getExporters(object)),
      ),
    ),
    shareReplay({refCount: true, bufferSize: 1}),
  );

  private readonly patritionedExporters$: Observable<Exporter[][]> = this.exporters$.pipe(
    map((exporters) => partition(this.isPrePublishExporter, exporters)),
  );

  readonly notPrePublishExporters$: Observable<Exporter[]> = this.patritionedExporters$.pipe(
    map(([_, notPrePublish]) => notPrePublish),
  );

  readonly prePublishExporters$: Observable<Exporter[]> = this.patritionedExporters$.pipe(
    map(([prePublish, _]) => prePublish),
  );

  isPrePublishExporter(exporter: Exporter) {
    return exporter.name === 'Zip'
  }

  ngOnChanges({object}: SimpleChanges) {
    if (object) {
      this.object$.next(object.currentValue);
    }
  }

  openExportDialogFactory(exporters: Exporter[]) {
    return () => this.actions.openExportDialog(
      this.object,
      {exporters},
    );
  }

  openPrePublishDialogFactory(prePublishExporters: Exporter[]) {
    return () => this.actions.openExportDialog(
      this.object,
      {
        exporters: prePublishExporters,
        accept: (value: ObjectExportDialogValue) =>
          this.actions.export(
            value,
            {label: 'Pre-publish object'},
          ),
        dismiss: this.actions.exportDismissFactory(
          this.object,
          {
            title: 'No Pre-publish Formats',
            message: `No pre-publish formats are supported for ${getObjectLabel(this.object)}.`,
          },
        ),
      },
    );
  }
}
