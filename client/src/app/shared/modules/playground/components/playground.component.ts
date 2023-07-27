import {
  AfterViewInit,
  Component,
  ComponentFactoryResolver,
  ComponentRef,
  Input,
  OnDestroy,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import { HttpDownloadProgressEvent } from '@angular/common/http';

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
  publish,
  scan,
  shareReplay,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs/operators';

import { OpenFileProvider } from '../../../providers/open-file/open-file.provider';
import { ExplainService } from '../../../services/explain.service';
import { ChatGPT } from '../ChatGPT';
import { CompletionsFormComponent } from './form/completions-form/completions-form.component';
import { ChatCompletionsFormComponent } from './form/chat-completions-form/chat-completions-form.component';
import { CompletionForm } from './form/interfaces';
import { ComponentType } from '@angular/cdk/overlay';

interface Result {
  choices: any[];
}

interface ModeRef {
  label: string;
  form: ComponentType<CompletionForm>;
  active?: boolean;
  componentRef?: ComponentRef<CompletionForm>;
}

@Component({
  selector: 'app-playground',
  styleUrls: ['./playground.component.scss'],
  templateUrl: './playground.component.html',
  encapsulation: ViewEncapsulation.None,
  entryComponents: [CompletionsFormComponent, ChatCompletionsFormComponent],
})
export class PlaygroundComponent implements OnDestroy, AfterViewInit {
  constructor(
    private readonly openFileProvider: OpenFileProvider,
    private readonly explainService: ExplainService,
    private readonly modal: NgbActiveModal,
    private readonly componentFactoryResolver: ComponentFactoryResolver
  ) {}

  @ViewChild('modeForm', { static: true, read: ViewContainerRef }) modeFormView: ViewContainerRef;
  @Input() entities: Iterable<string>;
  @Input() context: number;
  @Input() temperature: number;

  prompt$ = new ReplaySubject<string>(1);

  private destroy$: Subject<void> = new Subject();
  MODES: ModeRef[] = [
    { label: 'Completion', form: CompletionsFormComponent },
    { label: 'Chat', form: ChatCompletionsFormComponent },
  ];
  modeChange$: BehaviorSubject<ModeRef> = new BehaviorSubject<ModeRef>(_first(this.MODES));
  mode$ = this.modeChange$.pipe(
    scan((prev, next) => {
      if (prev) {
        const index = this.modeFormView.indexOf(prev.componentRef.hostView);
        if (index !== -1) {
          this.modeFormView.detach(index);
        }
      }
      if (next.componentRef) {
        this.modeFormView.insert(next.componentRef.hostView);
      } else {
        next.componentRef = this.modeFormView.createComponent(
          this.componentFactoryResolver.resolveComponentFactory(next.form)
        );
      }
      next.active = true;
      return next;
    }, null),
    publish()
  ) as ConnectableObservable<ModeRef>;

  request$ = this.mode$.pipe(switchMap(({ componentRef }) => componentRef.instance.request));

  result$ = this.request$.pipe(
    switchMap(({ result$, params }) =>
      iif(
        () => params.stream,
        (result$ as Observable<HttpDownloadProgressEvent>).pipe(
          tap((result) => console.log(result)),
          filter(({ partialText }) => Boolean(partialText)),
          mergeMap(({ partialText }) =>
            from(partialText.split('\n').filter(_identity)).pipe(
              map((partialTextLine: string) => JSON.parse(partialTextLine) as Partial<Result>),
              scan((acc, partial) =>
                _mergeWith((a, b, key, obj) =>
                  key === 'choices'
                    ? _values(
                        _mergeWith((ca, cb, ckey) =>
                          ckey === 'text' ? `${ca ?? ''}${cb ?? ''}` : undefined
                        )(_keyBy('index')(a), _keyBy('index')(b))
                      )
                    : undefined
                )(acc, partial)
              )
            )
          ),
          tap((result) => console.log(result))
        ),
        result$ as Observable<Result>
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
  loading$ = this.request$.pipe(
    switchMap(({ loading$ }) => loading$),
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

  lastPricingUpdate = ChatGPT.lastUpdate;

  ngAfterViewInit(): void {
    this.mode$.connect();
  }

  trackByIndex = ({ index }) => index;

  programaticChange(inputs) {
    Object.assign(this, inputs);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  close() {
    this.modal.close();
  }
}
