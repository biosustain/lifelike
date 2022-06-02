import { Component, Output, EventEmitter, HostBinding, ViewEncapsulation, Input, AfterViewInit } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';

import { switchMap, map } from 'rxjs/operators';
import { combineLatest } from 'rxjs';
import { entries, assign, isNil } from 'lodash-es';

import { debug } from 'app/shared/rxjs/debug';
import { ElementObserverDirective } from 'app/shared/directives/element-observer.directive';

import { ControllerService } from '../../services/controller.service';

class UniqueId {
  constructor(options: { networkTraceIdx: number, viewName?: string }) {
    assign(this, options);
  }

  networkTraceIdx: number;
  viewName: string;

  static resolve(uid) {
    if (uid instanceof UniqueId) {
      return uid;
    }
    if (uid.startsWith('nt_')) {
      const networkTraceIdx = Number(uid.replace('nt_', ''));
      return new UniqueId({networkTraceIdx});
    }
    if (uid.startsWith('view_')) {
      const [, networkTraceIdx, viewName] = uid.match(/^view_(\d+)_(.+)$/);
      return new UniqueId({networkTraceIdx: Number(networkTraceIdx), viewName});
    }
    throw new Error('Unknown option prefix');
  }

  toString() {
    if (isNil(this.viewName)) {
      return `nt_${this.networkTraceIdx}`;
    }
    return `view_${this.networkTraceIdx}_${this.viewName}`;
  }
}

@Component({
  selector: 'app-networktrace-view-dropdown-content',
  templateUrl: './networktrace-view-dropdown-content.component.html',
  styleUrls: ['./networktrace-view-dropdown-content.component.scss'],
  animations: [
    trigger('collapseAnimation', [
      state('in', style({
        transform: 'initial',
        height: 'initial',
        marginTop: 'initial',
        paddingTop: 'initial',
        marginBottom: 'initial',
        paddingBottom: 'initial',
      })),
      transition(
        ':enter',
        [
          style({
            transform: 'scaleY(0)',
            height: 0,
            marginTop: 0,
            paddingTop: 0,
            marginBottom: 0,
            paddingBottom: 0
          }),
          animate(100)
        ]
      ),
      transition(
        ':leave',
        animate(100, style({
          transform: 'scaleY(0)',
          height: 0,
          marginTop: 0,
          paddingTop: 0,
          marginBottom: 0,
          paddingBottom: 0
        }))
      )
    ]),
    trigger(
      'blockInitialRenderAnimation',
      [
        transition(':enter', [])
      ]
    )
  ],
  encapsulation: ViewEncapsulation.None
})
export class NetworktraceViewDropdownContentComponent implements AfterViewInit {
  @HostBinding('@blockInitialRenderAnimation') blockInitialRenderAnimation = true;

  constructor(
    public sankeyController: ControllerService
  ) {
  }

  @Output() selectNetworkTraceIdx = new EventEmitter<number>();
  @Output() selectView = new EventEmitter<{ networkTraceIdx, viewName }>();
  @Output() deleteView = new EventEmitter<{ networkTraceIdx, viewName }>();
  @Input() viewport: ElementObserverDirective;

  networkTracesViewsTree$ = this.sankeyController.networkTraces$.pipe(
    switchMap(networkTraces =>
      combineLatest(
        networkTraces.map((networkTrace, index) => {
          const networkTraceUID = new UniqueId({networkTraceIdx: index});
          return networkTrace.views$.pipe(
            map(views => ({
              id: networkTraceUID,
              name: networkTrace.name || networkTrace.description || 'Trace Description Unknown',
              children: entries(views).map(([key, value]) => ({
                id: new UniqueId({networkTraceIdx: index, viewName: key}),
                name: key
              }))
            }))
          );
        })
      )
    ),
    map(nestedOptions => ({
      children: nestedOptions
    })),
    debug('networkTracesAndViewsMap$')
  );

  selectUID(uid) {
    const {networkTraceIdx, viewName} = UniqueId.resolve(uid);
    if (isNil(viewName)) {
      this.selectNetworkTraceIdx.emit(networkTraceIdx);
    } else {
      this.selectView.emit({networkTraceIdx, viewName});
    }
  }

  deleteViewUID(uid) {
    const {networkTraceIdx, viewName} = UniqueId.resolve(uid);
    this.deleteView.emit({networkTraceIdx, viewName});
  }

  ngAfterViewInit() {
    this.blockInitialRenderAnimation = false;
  }
}
