import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import {
  distinctUntilChanged,
  map,
  mergeMap,
  shareReplay,
  startWith,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import { combineLatest, defer, iif, of, ReplaySubject, Subject } from 'rxjs';

import { Exporter } from 'app/file-types/providers/base-object.type-provider';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { MimeTypes } from 'app/shared/constants';
import { isNotEmpty } from 'app/shared/utils';
import { promiseOfOne } from 'app/shared/rxjs/to-promise';

import { FilesystemObject } from '../../models/filesystem-object';

@Component({
  selector: 'app-object-export-dialog',
  templateUrl: './object-export-dialog.component.html',
})
export class ObjectExportDialogComponent
  extends CommonFormDialogComponent<ObjectExportDialogValue>
  implements OnInit
{
  constructor(
    modal: NgbActiveModal,
    messageDialog: MessageDialog,
    protected readonly objectTypeService: ObjectTypeService
  ) {
    super(modal, messageDialog);
  }

  @Input() set target(target: FilesystemObject) {
    this.inputTarget$.next(target);
  }

  @Input() set exporters(exporters: Exporter[]) {
    this.inputExporters$.next(exporters);
  }

  @Input() title = 'Export';

  private readonly inputExporters$ = new ReplaySubject(1);
  readonly exporters$ = this.inputExporters$.asObservable().pipe(
    startWith(null),
    distinctUntilChanged(),
    switchMap((exporters) =>
      iif(
        () => isNotEmpty(exporters),
        of(exporters),
        this.inputTarget$.pipe(
          switchMap((target) =>
            this.objectTypeService
              .get(target)
              .pipe(mergeMap((typeProvider) => typeProvider.getExporters(target)))
          )
        )
      )
    ),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  private readonly inputTarget$ = new ReplaySubject<FilesystemObject>(1);
  private readonly target$ = this.inputTarget$
    .asObservable()
    .pipe(distinctUntilChanged(), shareReplay({ refCount: true, bufferSize: 1 }));
  private readonly destroy$ = new Subject();

  private readonly linkedExporters = ['PDF', 'PNG', 'SVG'];

  readonly form: FormGroup = new FormGroup({
    exporter: new FormControl(null, Validators.required),
    exportLinked: new FormControl(false),
  });

  private readonly currentExporter$ = combineLatest([
    this.exporters$,
    defer(() => {
      const exporterControl = this.form.get('exporter');
      return exporterControl.valueChanges.pipe(startWith(exporterControl.value));
    }),
  ]).pipe(
    map(([exporters, currentExporterIdx]) => exporters[currentExporterIdx]),
    distinctUntilChanged()
  );

  private isMapExport$ = this.target$.pipe(map((target) => target.mimeType === MimeTypes.Map));

  private state$ = this.isMapExport$.pipe(
    switchMap((isMapExport) =>
      this.currentExporter$.pipe(
        map((currentExporter) => ({
          exporter: currentExporter,
          isLinkedSupported: isMapExport && this.linkedExporters.includes(currentExporter.name),
        }))
      )
    ),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  readonly islinkedExportDisabled$ = this.state$.pipe(
    map((state) => !state.isLinkedSupported),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  ngOnInit() {
    this.exporters$.pipe(takeUntil(this.destroy$)).subscribe((exporters) => {
      if (exporters) {
        this.form.patchValue({
          exporter: 0,
        });
      } else {
        this.modal.dismiss(true);
      }
    });
  }

  getValue(): Promise<ObjectExportDialogValue> {
    return promiseOfOne(
      this.state$.pipe(
        map(({ exporter, isLinkedSupported }) => ({
          exporter,
          exportLinked: isLinkedSupported && this.form.get('exportLinked').value,
        }))
      )
    );
  }
}

export interface ObjectExportDialogValue {
  exporter: Exporter;
  exportLinked: boolean;
}
