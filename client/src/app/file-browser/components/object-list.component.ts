import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { isNil, merge, uniqueId } from 'lodash-es';
import { isEqual as _isEqual, defer as _defer } from 'lodash/fp';
import { BehaviorSubject, defer } from 'rxjs';
import { distinctUntilChanged, finalize, map, tap } from 'rxjs/operators';

import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { WorkspaceManager, WorkspaceNavigationExtras } from 'app/shared/workspace-manager';
import { openInternalLink, toValidUrl } from 'app/shared/utils/browser';
import { CollectionModel } from 'app/shared/utils/collection-model';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { openDownloadForBlob } from 'app/shared/utils/files';
import { ElementObserverDirective } from 'app/shared/directives/element-observer.directive';
import { debug } from 'app/shared/rxjs/debug';

import { FilesystemObject } from '../models/filesystem-object';
import { FilesystemObjectActions } from '../services/filesystem-object-actions';
import { getObjectLabel } from '../utils/objects';
import { FilesystemService } from '../services/filesystem.service';

enum Columns {
  checkbox,
  star,
  name,
  annotation,
  size,
  modified,
  author,
  controls,
}

@Component({
  selector: 'app-object-list',
  templateUrl: './object-list.component.html',
})
export class ObjectListComponent {
  id = uniqueId('FileListComponent-');

  @Input() appLinks: boolean | WorkspaceNavigationExtras = false;
  @Input() forEditing = true;
  @Input() showStars = true;
  @Input() showDescription = false;
  @Input() parent: FilesystemObject | undefined;
  @Input() objects: CollectionModel<FilesystemObject> | undefined;
  @Input() objectControls = true;
  @Input() emptyDirectoryMessage = 'There are no items in this folder.';
  @Output() refreshRequest = new EventEmitter<string>();
  @Output() objectOpen = new EventEmitter<FilesystemObject>();
  MAX_TOOLTIP_LENGTH = 800;
  private readonly columns = Columns;
  @ViewChild(ElementObserverDirective, { static: true })
  tableContainerObserver: ElementObserverDirective;

  constructor(
    protected readonly router: Router,
    protected readonly snackBar: MatSnackBar,
    protected readonly modalService: NgbModal,
    protected readonly errorHandler: ErrorHandler,
    protected readonly route: ActivatedRoute,
    protected readonly workspaceManager: WorkspaceManager,
    protected readonly actions: FilesystemObjectActions,
    protected readonly filesystemService: FilesystemService,
    protected readonly elementRef: ElementRef,
    protected readonly progressDialog: ProgressDialog,
    private readonly cdr: ChangeDetectorRef
  ) {}

  private readonly COLUMNS_WIDTHS_IN_IMPORTANCE_ORDER: Map<Columns, number> = new Map([
    [Columns.name, 260],
    [Columns.checkbox, 19.2 + 16 + 7.2],
    [Columns.controls, 80],
    [Columns.star, 7.2 + 16 + 7.2],
    [Columns.annotation, 150],
    [Columns.author, 80],
    [Columns.modified, 80],
    [Columns.size, 90],
  ]);

  get activeColumnsWidths(): Map<Columns, number> {
    // Zeroed disabled columns while preserving order
    const activeColumnsWidth = new Map(this.COLUMNS_WIDTHS_IN_IMPORTANCE_ORDER);
    if (!this.showStars) {
      activeColumnsWidth.set(Columns.star, 0);
    }
    if (!this.objectControls) {
      activeColumnsWidth.set(Columns.controls, 0);
    }
    return activeColumnsWidth;
  }

  columnsWidth$ = defer(() =>
    // This is subscribed within tableContainer thereferore if we defer it,
    // we can be sure that it will be subscribed after tableContainerObserver is initialized
    this.tableContainerObserver.size$.pipe(
      map((containerSize) => this.caluculateColumnsWidths(containerSize)),
      distinctUntilChanged(_isEqual),
      // Simply couldn't get it to work without this
      tap(() => _defer(() => this.cdr.detectChanges())),
      debug('columnsWidth$')
    )
  );

  caluculateColumnsWidths(containerWidth: { width: number }): Record<Columns, number> {
    let remainingWidth = containerWidth?.width ?? 0;
    const columnsWidths = {
      [Columns.name]: 0,
    } as Record<Columns, number>;

    for (const [column, defaultWidth] of this.activeColumnsWidths.entries()) {
      if (remainingWidth > defaultWidth) {
        columnsWidths[column] = defaultWidth;
        remainingWidth -= defaultWidth;
      } else {
        break;
      }
    }
    columnsWidths[Columns.name] += remainingWidth;
    return columnsWidths;
  }

  objectDragStart(event: DragEvent, object: FilesystemObject) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    // TODO: Move to DataTransferData framework
    object.addDataTransferData(dataTransfer);

    // At this time, we don't support dragging multiple items
    this.objects.selectOnly(object);

    // Do not bubble as tab drag event
    event.stopPropagation();
  }

  openParentEditDialog() {
    return this.actions.openEditDialog(this.parent).then(
      () => {
        this.snackBar.open(`Saved changes to ${getObjectLabel(this.parent)}.`, 'Close', {
          duration: 5000,
        });
      },
      () => {}
    );
  }

  openObject(target: FilesystemObject) {
    this.objectOpen.emit(target);

    if (this.appLinks) {
      if (target.isOpenable) {
        // TODO: Normally this would just be handled by the `appLink` directive. Really, we should update the template to either:
        //  - Use appLink
        //  - Use a callback that does the download portion of the `else` block below
        openInternalLink(
          this.workspaceManager,
          toValidUrl(this.router.createUrlTree(target.getCommands()).toString()),
          merge({ newTab: !target.isDirectory }, this.appLinks)
        );
      } else {
        const progressDialogRef = this.progressDialog.display({
          title: `Download ${getObjectLabel(target)}`,
          progressObservables: [
            new BehaviorSubject<Progress>(
              new Progress({
                status: 'Generating download...',
              })
            ),
          ],
        });
        this.filesystemService
          .getContent(target.hashId)
          .pipe(
            map((blob) => {
              return new File([blob], target.filename);
            }),
            tap((file) => {
              openDownloadForBlob(file, file.name);
            }),
            finalize(() => progressDialogRef.close()),
            this.errorHandler.create({ label: 'Download file' })
          )
          .subscribe();
      }
    }
  }

  updateView() {
    this.objects.updateView();
  }

  toggleStarred(object: FilesystemObject) {
    this.filesystemService
      .updateStarred(object.hashId, isNil(object.starred))
      .toPromise()
      .then((result) => {
        object.update(result);
        this.updateView();
      });
  }
}
