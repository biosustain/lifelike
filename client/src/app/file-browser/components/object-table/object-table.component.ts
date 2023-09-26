import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  QueryList,
  Renderer2,
  SimpleChanges,
  ViewChild,
  ViewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

import {
  every as _every,
  filter as _filter,
  flow as _flow,
  fromPairs as _fromPairs,
  isEmpty as _isEmpty,
  isEqual as _isEqual,
  map as _map,
  negate as _not,
} from 'lodash/fp';
import {
  animationFrameScheduler,
  combineLatest,
  defer,
  Observable,
  ReplaySubject,
  Subject,
} from 'rxjs';
import { distinctUntilChanged, map, shareReplay, takeUntil, throttleTime } from 'rxjs/operators';
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap';

import { runInAngularZone } from 'app/shared/rxjs/run-in-angular-zone';
import { createMutationObservable } from 'app/shared/rxjs/mutation-observable';
import { FlexColumn, FlexColumnsLayout } from 'app/shared/utils/tables/flex-columns.layout';
import { AppResizableColumnDirective } from 'app/shared/directives/app-resizable-column.directive';
import { updateSubject } from 'app/shared/rxjs/update';
import { WorkspaceNavigationExtras } from 'app/shared/workspace-manager';
import { CollectionModel } from 'app/shared/utils/collection-model';
import { relativePosition } from 'app/shared/DOMutils';

import { ObjectListService } from '../../services/object-list.service';
import { FilesystemObject } from '../../models/filesystem-object';

export enum ObjectTableColumn {
  // Need to use strings because Angular CDK table uses strings
  checkbox = 'checkbox',
  star = 'star',
  name = 'name',
  annotation = 'annotation',
  size = 'size',
  modified = 'modified',
  author = 'author',
  controls = 'controls',
}

class Column implements FlexColumn {
  constructor(readonly id: ObjectTableColumn, options: Partial<Column> = {}) {
    Object.assign(this, options);
  }

  hidden: boolean;

  flexGrow: number;
  flexShrink: number;

  width: string | number; // CSS value in px or %
  flexBasis: string | number; // CSS value in px or %
  minContent: number;
  maxContent: number;
}

@Component({
  selector: 'app-object-table',
  templateUrl: './object-table.component.html',
  styleUrls: ['./object-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class ObjectTableComponent implements OnChanges, OnDestroy, AfterViewInit {
  constructor(
    private readonly ngZone: NgZone,
    readonly controler: ObjectListService,
    private readonly renderer: Renderer2
  ) {}

  @Input() readonly size$!: Observable<DOMRectReadOnly>;
  @Input() appLinks!: boolean | WorkspaceNavigationExtras;
  @Input() forEditing!: boolean;
  @Input() showStars!: boolean;
  @Input() showDescription!: boolean;
  @Input() parent!: FilesystemObject | undefined;
  @Input() objects!: CollectionModel<FilesystemObject> | undefined;
  @Input() objectControls!: boolean;
  @Input() emptyDirectoryMessage!: string;
  @ViewChild('headerRow', { read: ElementRef }) headerRow: ElementRef<HTMLElement>;
  @ViewChild('columnSelectionPopover') columnSelectionPopover: NgbPopover;
  @ViewChild('contextMenuContainer', { read: ElementRef })
  contextMenuContainer: ElementRef<HTMLElement>;
  @ViewChildren(AppResizableColumnDirective, { read: ElementRef })
  readonly ths: QueryList<ElementRef<HTMLElement>>;
  private readonly manualWidthChange$: Observable<Record<string, string>> =
    createMutationObservable(
      defer(() => this.ths.changes).pipe(
        map(() =>
          this.ths
            .toArray()
            .map((th) => [th.nativeElement, { attributes: true, attributeFilter: ['style'] }])
        )
      )
    ).pipe(
      map(
        _flow(
          _map(({ target }) => [
            (target as HTMLElement).getAttribute(AppResizableColumnDirective.COLUMN_ID_ATTR),
            (target as HTMLElement).style.width,
          ]),
          _filter(_every(_not(_isEmpty))), // Filter missing ids and widths
          _fromPairs
        )
      )
    );

  popoverContainerPosition: { x: number; y: number } = { x: 0, y: 0 };

  private readonly destroy$ = new Subject<void>();
  MAX_TOOLTIP_LENGTH = 800;

  // add enum ref to template
  readonly columnEnum = ObjectTableColumn;

  /**
   * This is a list of all defined columns, although this list is readonly
   * each column propeteries can be mutated in place
   */
  private readonly DEFINED_COLUMNS: Readonly<Column[]> = [
    new Column(ObjectTableColumn.checkbox, { width: 7.2 + 16 + 7.2, flexShrink: 0 }),
    new Column(ObjectTableColumn.star, { width: 7.2 + 16 + 7.2, flexShrink: 0 }),
    new Column(ObjectTableColumn.name, { width: 260, flexGrow: 10 }),
    new Column(ObjectTableColumn.annotation, { width: 150, flexGrow: 1 }),
    new Column(ObjectTableColumn.author, { width: 80, flexGrow: 1 }),
    new Column(ObjectTableColumn.modified, { width: 80, flexGrow: 1 }),
    new Column(ObjectTableColumn.size, { width: 90, flexGrow: 1 }),
    new Column(ObjectTableColumn.controls, { width: 80, flexShrink: 0 }),
  ];

  /**
   * Observable that emits list of columns that should be displayed
   * @private
   */
  readonly columns$: Subject<Column[]> = new ReplaySubject(1);

  readonly flexColumnsLayout$ = combineLatest([
    this.columns$.pipe(map((columns) => columns.filter((column) => !column.hidden))),
    defer(() => this.size$).pipe(
      // defer to avoid subscribing before ngOnInit
      map(({ width }) => width),
      distinctUntilChanged() // don't react to height changes
    ),
  ]).pipe(
    // first and last columns has additional margin of 12px on each side
    map(([columns, width]) => FlexColumnsLayout.recalculate(width - 24, columns)),
    runInAngularZone(this.ngZone),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  /**
   * Observable that emits ids of columns that should be displayed
   * Ussed by cdk-table to display only selected columns in given order
   */
  readonly displayedColumnsIds$ = this.flexColumnsLayout$.pipe(
    map(_map('column.id')),
    distinctUntilChanged(_isEqual),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  ngOnChanges({ showStars, objectControls }: SimpleChanges) {
    if (showStars || objectControls) {
      // Hide columns based on options
      const hideColumns = [] as ObjectTableColumn[];
      if (!this.showStars) {
        hideColumns.push(ObjectTableColumn.star);
      }
      if (!this.objectControls) {
        hideColumns.push(ObjectTableColumn.controls);
      }
      // initialize columns
      this.columns$.next(
        _filter((column: Column) => !hideColumns.includes(column.id))(this.DEFINED_COLUMNS)
      );
    }
  }

  ngAfterViewInit() {
    this.manualWidthChange$.pipe(takeUntil(this.destroy$)).subscribe((widths) =>
      updateSubject(this.columns$, (columns) => {
        for (const [id, width] of Object.entries(widths)) {
          const columnIndex = columns.findIndex((c) => c.id === id);
          const column = columns[columnIndex];
          column.width = width;
          column.flexGrow = 0;
        }
        return columns;
      })
    );
  }

  ngOnDestroy() {
    this.destroy$.next();
  }

  hideToggleColumn(columnId: ObjectTableColumn) {
    updateSubject(this.columns$, (columns) => {
      const column = columns.find((c) => c.id === columnId);
      column.hidden = !column.hidden;
      return columns;
    });
  }

  reorder(event: CdkDragDrop<any>) {
    updateSubject(this.columns$, (columns) => {
      moveItemInArray(columns, event.previousIndex, event.currentIndex);
      return columns;
    });
  }

  openHeaderContextMenu(event) {
    const positionDelta = relativePosition(this.headerRow.nativeElement)(event.target);
    this.renderer.setStyle(
      this.contextMenuContainer.nativeElement,
      'left',
      `${positionDelta.left + event.offsetX}px`
    );
    this.columnSelectionPopover.open();
  }
}
