import {
  Component,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { BehaviorSubject, combineLatest, Observable, ReplaySubject, Subject } from 'rxjs';
import {
  distinctUntilChanged, filter,
  map,
  shareReplay,
  startWith,
  switchMap,
  takeUntil,
} from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';

import { ExplainService } from '../../services/explain.service';
import {
  DropdownController,
  dropdownControllerFactory,
} from '../../utils/dropdown.controller.factory';
import { OpenFileProvider } from '../../providers/open-file/open-file.provider';


@Component({
  selector: 'app-prompt',
  templateUrl: './prompt.component.html'
})
export class PromptComponent implements OnDestroy, OnChanges {
  constructor(
    private readonly explainService: ExplainService,
    private readonly openFileProvider: OpenFileProvider
  ) {}
  @Input() entities!: Iterable<string>;
  private destroy$: Subject<void> = new Subject();
  private change$: Subject<SimpleChanges> = new Subject();
  private tempertaure$: Subject<number> = new BehaviorSubject(0);
  private entities$: Observable<PromptComponent['entities']> = this.change$.pipe(
    filter(({entities}) => Boolean(entities)),
    map(({entities}) => entities.currentValue),
    shareReplay({bufferSize: 1, refCount: true}),
  );
  private contexts$: Observable<FilesystemObject['contexts']> = this.openFileProvider.object$.pipe(
    map(({contexts}) => contexts),
    startWith([]),
    distinctUntilChanged(),
    shareReplay({bufferSize: 1, refCount: true}),
  );
  contextsController$: Observable<DropdownController<string>> = this.contexts$.pipe(
    map(dropdownControllerFactory),
    shareReplay({bufferSize: 1, refCount: true}),
  );

  possibleExplanation$: Observable<string> = combineLatest([
    this.entities$.pipe(
      distinctUntilChanged()
    ),
    this.tempertaure$.pipe(
      distinctUntilChanged()
    ),
    this.contextsController$.pipe(
      switchMap(controller => controller.current$)
    )
  ]).pipe(
    takeUntil(this.destroy$),
    switchMap(([entities, temperature, context]) =>
      this.explainService.relationship(
        entities,
        context,
        { temperature }
      ).pipe(
        startWith(undefined)
      )
    )
  );

  public ngOnChanges(change: SimpleChanges) {
    this.change$.next(change);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
