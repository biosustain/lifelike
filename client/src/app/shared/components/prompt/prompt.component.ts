import { Component, Injector, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, combineLatest, defer, Observable, ReplaySubject, Subject } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map, observeOn,
  shareReplay,
  startWith,
  switchMap,
  takeUntil, withLatestFrom,
} from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';

import { OpenFileProvider } from '../../providers/open-file/open-file.provider';
import { ExplainService } from '../../services/explain.service';
import {
  DropdownController,
  dropdownControllerFactory,
} from '../../utils/dropdown.controller.factory';
import { PlaygroundComponent } from './playground.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-prompt',
  templateUrl: './prompt.component.html',
})
export class PromptComponent implements OnDestroy, OnChanges {
  constructor(
    private readonly explainService: ExplainService,
    private readonly openFileProvider: OpenFileProvider,
    private readonly modalService: NgbModal,
    private readonly injector: Injector
  ) {}

  @Input() entities!: Iterable<string>;
  private destroy$: Subject<void> = new Subject();
  private change$: Subject<SimpleChanges> = new Subject();
  tempertaure$: Subject<number> = new BehaviorSubject(0);
  private entities$: Observable<PromptComponent['entities']> = defer(() =>
    this.change$.pipe(
      filter(({ entities }) => Boolean(entities)),
      map(({ entities }) => entities.currentValue),
      startWith(this.entities),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    )
  );
  private contexts$: Observable<FilesystemObject['contexts']> = this.openFileProvider.object$.pipe(
    map(({ contexts }) => contexts),
    startWith([]),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  contextsController$: Observable<DropdownController<string>> = this.contexts$.pipe(
    map(dropdownControllerFactory),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  params$ = combineLatest([
    this.entities$,
    this.tempertaure$.pipe(distinctUntilChanged()),
    this.contextsController$.pipe(switchMap((controller) => controller.current$)),
  ]).pipe(
    map(([entities, temperature, context]) => ({ entities, temperature, context })),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  /**
   * This subject is used to trigger the explanation generation and its value changes output visibility.
   */
  explain$ = new ReplaySubject<boolean>(1);

  explanation$: Observable<string> = this.explain$.pipe(
    withLatestFrom(this.params$),
    map(([_, params]) => params),
    takeUntil(this.destroy$),
    switchMap(({ entities, temperature, context }) =>
      this.explainService
        .relationship(entities, context, { temperature })
        .pipe(startWith(undefined))
    )
  );

  showPlayground = environment.chatGPTPlaygroundEnabled;

  generateExplanation() {
    this.explain$.next(true);
  }

  public ngOnChanges(change: SimpleChanges) {
    this.change$.next(change);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openPlayground() {
    const playground = this.modalService.open(PlaygroundComponent, {
      injector: this.injector,
      size: 'xl',
    });
    const paramsSubscription = this.params$.subscribe((params) => {
      playground.componentInstance.programaticChange(params);
    });
    return playground.result.finally(() => {
      paramsSubscription.unsubscribe();
    });
  }
}
