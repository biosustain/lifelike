import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';

import { Subject } from 'rxjs';
import { map, shareReplay, takeUntil, withLatestFrom } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { GenericTableComponent } from 'app/shared/components/table/generic-table.component';
import { closePopups, relativePosition } from 'app/shared/DOMutils';
import { createResizeObservable } from 'app/shared/rxjs/resize-observable';

import { EnrichmentTable } from '../../models/enrichment-table';
import { FindControlerService } from '../../services/find-controler.service';


@Component({
  selector: 'app-enrichment-table',
  styleUrls: ['enrichment-table.component.scss'],
  templateUrl: './enrichment-table.component.html',
})
export class EnrichmentTableComponent implements OnDestroy, AfterViewInit {
  constructor(
    private readonly findControlerService: FindControlerService,
    private readonly element: ElementRef,
  ) {
  }

  private destroy$ = new Subject<any>();
  @ViewChild(GenericTableComponent) table: GenericTableComponent;
  @ViewChild('findTarget') findTarget: ElementRef;

  @Input() data: EnrichmentTable;
  @Input() object: FilesystemObject;

  ngAfterViewInit() {
    this.findControlerService.focusElement$.pipe(
      withLatestFrom(
        // Possibly changing margin which is dependednt on table headers
        createResizeObservable(
          this.table.head.nativeElement,
          {leading: true},
        ).pipe(
          map(({height}) => ({
            top: height + 20,
            bottom: 20,
            left: 20,
            right: 20,
          }))
        )
      ),
      takeUntil(this.destroy$),
    ).subscribe(([result, m]) => {
      const {
        top,
        bottom,
        left,
        right,
      } = relativePosition(this.element.nativeElement)(result.startNode.parentElement);
      this.element.nativeElement.scrollBy({
          // move to element + margin or 0 if within margins (takes left/top precedence if not fits)
          top: top < m.top ? top - m.top : -m.bottom < bottom ? bottom + m.bottom : 0,
          left: left < m.left ? left - m.left : -m.right < right ? right + m.right : 0,
          behaviour: 'smooth'
      });
    });
    this.findControlerService.target$.next(
      this.findTarget.nativeElement
    );
  }

  scrollTop() {
    const elem = this.element.nativeElement;
    return elem.scrollTo({
      top: 0,
      left: elem.scrollLeft,
    });
  }

  onTableScroll(e) {
    closePopups();
  }

  ngOnDestroy() {
    this.destroy$.next();
  }
}
