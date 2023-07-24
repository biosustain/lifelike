import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ContentChild,
  Input,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import {
  identity as _identity,
  keyBy as _keyBy,
  mergeWith as _mergeWith,
  values as _values,
} from 'lodash/fp';
import { BehaviorSubject, EMPTY, from, iif, Observable, of, ReplaySubject, Subject } from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  mergeMap,
  scan,
  shareReplay,
  startWith,
  switchMap,
  takeUntil,
  tap,
  withLatestFrom,
} from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';

import { OpenFileProvider } from '../../../providers/open-file/open-file.provider';
import { ExplainService } from '../../../services/explain.service';
import { ChatGPT, CompletitionsParams } from './ChatGPT';
import { ChatGptFormComponent } from './chat-gpt-form/chat-gpt-form.component';
import { PromptComposerDirective } from './prompt-composer/prompt-composer.directive';

@Component({
  selector: 'app-playground',
  styleUrls: ['./playground.component.scss'],
  templateUrl: './playground.component.html',
  encapsulation: ViewEncapsulation.None,
  providers: [ChatGPT],
})
export class PlaygroundComponent implements OnDestroy {
  constructor(
    private readonly openFileProvider: OpenFileProvider,
    private readonly explainService: ExplainService,
    private readonly modal: NgbActiveModal,
  ) {
  }


  @Input() entities: Iterable<string>;
  @Input() temperature: number;
  @Input() context: number;
  @ViewChild(PromptComposerDirective) promptComposer: PromptComposerDirective;
  prompt$ = this.promptComposer.prompt$;
  @ViewChild(ChatGptFormComponent) chatGptForm: ChatGptFormComponent;

  private destroy$: Subject<void> = new Subject();
  contexts$: Observable<FilesystemObject['contexts']> = this.openFileProvider.object$.pipe(
    map(({contexts}) => contexts),
    startWith([]),
    distinctUntilChanged(),
    shareReplay({bufferSize: 1, refCount: true}),
  );

  requestParams$ = new ReplaySubject<CompletitionsParams>(1);

  request$ = this.requestParams$.pipe(
    map((params) => {
      const loading$ = new BehaviorSubject(true);
      const error$ = new ReplaySubject<HttpErrorResponse>(1);
      const result$: Observable<any> = this.explainService.playground(params).pipe(
        tap(() => loading$.next(false)),
        catchError((error) => {
          error$.next(error);
          return EMPTY;
        }),
        finalize(() => {
          loading$.complete();
          error$.complete();
        }),
        shareReplay({bufferSize: 1, refCount: true}),
      );

      return {
        params,
        loading$,
        error$,
        result$,
      };
    }),
    shareReplay({bufferSize: 1, refCount: true}),
  );

  result$ = this.request$.pipe(
    switchMap(({result$, params}) =>
      iif(
        () => params.stream,
        result$.pipe(
          tap((result) => console.log(result)),
          filter(({partialText}) => Boolean(partialText)),
          mergeMap(({partialText}) =>
            from(partialText.split('\n').filter(_identity)).pipe(
              map((partialTextLine: string) => JSON.parse(partialTextLine)),
              scan((acc, partial) =>
                _mergeWith((a, b, key, obj) =>
                  key === 'choices'
                    ? _values(
                      _mergeWith((ca, cb, ckey) =>
                        ckey === 'text' ? `${ca ?? ''}${cb ?? ''}` : undefined,
                      )(_keyBy('index')(a), _keyBy('index')(b)),
                    )
                    : undefined,
                )(acc, partial),
              ),
            ),
          ),
          tap((result) => console.log(result)),
          map((result) => ({result, cached: false})),
        ),
        result$,
      ),
    ),
    takeUntil(this.destroy$),
    shareReplay({bufferSize: 1, refCount: true}),
  );

  requestCost$ = this.result$.pipe(
    withLatestFrom(this.requestParams$),
    map(
      ([{result}, params]) =>
        ChatGPT.getModelTokenCost(params.model) * result?.usage?.total_tokens,
    ),
  );

  cached$ = this.result$.pipe(map(({cached}) => cached));

  resultJSON$: Observable<any> = this.result$.pipe(
    map((result) => JSON.stringify(result.result ?? result, null, 2)),
    catchError((error) => of(`Error: ${error}`)),
    takeUntil(this.destroy$),
  );

  resultChoices$ = this.result$.pipe(
    map(({result}) => result?.choices ?? []),
    catchError((error) => of(`Error: ${error}`)),
  );

  prompt: string;

  trackByIndex = ({index}) => index;


  programaticChange(inputs) {
    Object.assign(this, inputs);
    // this.ngOnChanges(_mapValues((currentValue) => ({ currentValue }))(inputs) as SimpleChanges);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSubmitRequest(requestParams) {
    this.requestParams$.next(requestParams);
  }

  close() {
    this.modal.close();
  }
}
