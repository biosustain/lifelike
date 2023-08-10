import { ComponentType } from '@angular/cdk/overlay';
import { HttpDownloadProgressEvent } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  ComponentFactoryResolver,
  ComponentRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import {
  first as _first,
  identity as _identity,
  keyBy as _keyBy,
  mergeWith as _mergeWith,
  values as _values,
} from 'lodash/fp';
import {
  BehaviorSubject,
  ConnectableObservable,
  from,
  iif,
  merge,
  Observable,
  of,
  ReplaySubject,
  Subject,
} from 'rxjs';
import {
  catchError,
  filter,
  map,
  mergeMap,
  scan,
  shareReplay,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs/operators';

import { OpenFileProvider } from 'app/shared/providers/open-file/open-file.provider';
import { DynamicViewService } from 'app/shared/services/dynamic-view.service';
import { ExplainService } from 'app/shared/services/explain.service';

import { ChatCompletionsFormComponent } from './form/chat-completions-form/chat-completions-form.component';
import { CompletionsFormComponent } from './form/completions-form/completions-form.component';
import { CompletionForm } from './form/interfaces';

interface Result {
  choices: any[];
}

interface ModeRef {
  label: string;
  form: ComponentType<CompletionForm>;
  componentRef?: ComponentRef<CompletionForm>;
}

@Component({
  selector: 'app-playground',
  styleUrls: ['./playground.component.scss'],
  templateUrl: './playground.component.html',
  encapsulation: ViewEncapsulation.None,
  entryComponents: [CompletionsFormComponent, ChatCompletionsFormComponent],
})
export class PlaygroundComponent implements OnDestroy, OnChanges {
  constructor(
    private readonly openFileProvider: OpenFileProvider,
    private readonly explainService: ExplainService,
    private readonly modal: NgbActiveModal,
    private readonly componentFactoryResolver: ComponentFactoryResolver,
    private readonly dynamicViewService: DynamicViewService,
    public readonly cdr: ChangeDetectorRef
  ) {
    this.params$.subscribe();
    this.prompt$.subscribe((v) => console.log(v));
  }

  @ViewChild('modeForm', { static: true, read: ViewContainerRef }) modeFormView: ViewContainerRef;
  @Input() entities: Iterable<string>;
  @Input() context: number;
  @Input() temperature: number;

  prompt$ = new ReplaySubject<string>(1);
  private temperature$ = new ReplaySubject<number>(1);
  params$: Observable<CompletionForm['params']> = merge(
    this.prompt$.pipe(map((prompt) => ({ prompt }))),
    this.temperature$.pipe(map((temperature) => ({ temperature })))
  );

  private destroy$: Subject<void> = new Subject();
  MODES: ModeRef[] = [
    { label: 'Chat', form: ChatCompletionsFormComponent },
    { label: 'Completion', form: CompletionsFormComponent },
  ];
  modeChange$: BehaviorSubject<ModeRef> = new BehaviorSubject<ModeRef>(_first(this.MODES));
  mode$ = this.modeChange$.pipe(
    scan((prev, next) => {
      if (prev) {
        this.dynamicViewService.detach(this.modeFormView, prev.componentRef);
      }
      if (next.componentRef) {
        // Reattach existing component
        this.dynamicViewService.insert(this.modeFormView, next.componentRef);
      } else {
        // Create new component
        next.componentRef = this.dynamicViewService.createComponent(
          this.modeFormView,
          next.form,
          this.params$.pipe(map((params) => ({ params })))
        );
      }
      return next;
    }, null)
  ) as ConnectableObservable<ModeRef>;

  request$ = this.mode$.pipe(switchMap(({ componentRef }) => componentRef.instance.request));

  result$ = this.request$.pipe(
    switchMap(({ result$, params }) =>
      iif(
        () => params.stream,
        (result$ as Observable<HttpDownloadProgressEvent>).pipe(
          filter(({ partialText }) => Boolean(partialText)),
          mergeMap(({ partialText }) =>
            from(partialText.split('\n').filter(_identity)).pipe(
              map((partialTextLine: string) => JSON.parse(partialTextLine) as Partial<Result>),
              scan((acc, partial) =>
                _mergeWith((a, b, key, obj) =>
                  key === 'choices'
                    ? _values(
                        _mergeWith((ca, cb, ckey) =>
                          ckey in ['text', 'content'] ? `${ca ?? ''}${cb ?? ''}` : undefined
                        )(_keyBy('index')(a), _keyBy('index')(b))
                      )
                    : undefined
                )(acc, partial)
              )
            )
          ),
          tap((result) => console.log(result))
        ),
        result$
      )
    ),
    takeUntil(this.destroy$),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  cached$ = this.request$.pipe(
    switchMap(({ cached$ }) => cached$),
    takeUntil(this.destroy$),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  requestCost$ = this.request$.pipe(
    switchMap(({ cost$ }) => cost$),
    takeUntil(this.destroy$),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  resultJSON$: Observable<any> = this.result$.pipe(
    map((result) => JSON.stringify(result, null, 2)),
    catchError((error) => of(`Error: ${error}`)),
    takeUntil(this.destroy$)
  );

  resultChoices$ = this.result$.pipe(
    map(({ choices }) => choices ?? []),
    catchError((error) => of(`Error: ${error}`))
  );

  ngOnChanges({ temperature }: SimpleChanges) {
    if (temperature) {
      this.temperature$.next(temperature.currentValue);
    }
  }

  trackByIndex = ({ index }) => index;

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  close() {
    this.modal.close();
  }
}
