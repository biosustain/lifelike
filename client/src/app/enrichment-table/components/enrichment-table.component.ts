import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';

import { Subject } from 'rxjs';
import { filter, map, shareReplay, switchMap, takeUntil, withLatestFrom } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { GenericTableComponent } from 'app/enrichment-table/components/generic-table/generic-table.component';
import { closePopups, relativePosition } from 'app/shared/utils/dom';
import { createResizeObservable } from 'app/shared/rxjs/resize-observable';
import { NodeTextRange } from 'app/shared/utils/dom';

import { EnrichmentTable } from '../models/enrichment-table';
import { FindControllerService } from '../services/find-controller.service';

@Component({
  selector: 'app-enrichment-table',
  styleUrls: ['enrichment-table.component.scss'],
  templateUrl: './enrichment-table.component.html',
})
export class EnrichmentTableComponent implements OnDestroy, AfterViewInit {
  constructor(
    private readonly findControllerService: FindControllerService,
    public readonly element: ElementRef
  ) {}

  private readonly destroy$ = new Subject<any>();
  @ViewChild(GenericTableComponent) table: GenericTableComponent;

  @Input() data: EnrichmentTable;
  @Input() object: FilesystemObject;

  ngAfterViewInit() {
    // Ussing this.findControllerService.search$ instead of this.findControllerService.current$ to avoid
    // fireing in Angular's zone.
    this.findControllerService.search$
      .pipe(
        switchMap(({ current$ }) => current$),
        filter(Boolean),
        withLatestFrom(
          // Possibly changing margin which is dependednt on table headers
          createResizeObservable(this.table.head.nativeElement, { leading: true }).pipe(
            map(({ height }) => ({
              top: height + 20,
              bottom: 20,
              left: 20,
              right: 20,
            }))
          )
        ),
        takeUntil(this.destroy$)
      )
      .subscribe(([result, m]: [NodeTextRange, Margin]) => {
        const { top, bottom, left, right } = relativePosition(this.element.nativeElement)(
          result.startNode.parentElement
        );
        this.element.nativeElement.scrollBy({
          // move to element + margin or 0 if within margins (takes left/top precedence if not fits)
          top: top < m.top ? top - m.top : -m.bottom < bottom ? bottom + m.bottom : 0,
          left: left < m.left ? left - m.left : -m.right < right ? right + m.right : 0,
          behaviour: 'smooth',
        });
      });
    this.findControllerService.target$.next(this.table.elementRef.nativeElement);
  }

  scrollTop() {
    const elem = this.element.nativeElement;
    return elem.scrollTo({
      top: 0,
      left: elem.scrollLeft,
      behaviour: 'smooth',
    });
  }

  onTableScroll(e) {
    closePopups();
  }

  ngOnDestroy() {
    this.destroy$.next();
  }
}

interface Margin {
  top: number;
  left: number;
  bottom: number;
  right: number;
}