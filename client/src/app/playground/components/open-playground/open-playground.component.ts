import {
  Component,
  ComponentFactoryResolver,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { ComponentType } from '@angular/cdk/overlay';

import { defer, ReplaySubject, Subject } from 'rxjs';
import { startWith, takeUntil } from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { PlaygroundComponent } from 'app/playground/components/playground.component';
import { openModal } from 'app/shared/utils/modals';
import { DynamicViewService } from 'app/shared/services/dynamic-view.service';

import { environment } from '../../../../environments/environment';

export interface OpenPlaygroundParams<PromptParams = Record<string, any>, C = any> {
  temperature?: number;
  promptFormParams: PromptParams;
  promptForm: ComponentType<C>;
}

@Component({
  selector: 'app-open-playground',
  templateUrl: './open-playground.component.html',
})
export class OpenPlaygroundComponent implements OnDestroy, OnChanges {
  constructor(
    private readonly modalService: NgbModal,
    private readonly componentFactoryResolver: ComponentFactoryResolver,
    private readonly injector: Injector
  ) {}

  private readonly destroy$ = new Subject();
  @Input() params!: OpenPlaygroundParams;
  private readonly paramsChange$ = new ReplaySubject<OpenPlaygroundComponent['params']>(1);
  private readonly params$ = defer(() =>
    this.paramsChange$.pipe(startWith(this.params), takeUntil(this.destroy$))
  );

  showPlayground = environment.chatGPTPlaygroundEnabled;

  openPlayground() {
    const playground = openModal(this.modalService, PlaygroundComponent, {
      size: 'xl',
      injector: this.injector,
    });
    const playgroundCdr = playground.componentInstance.cdr;
    const paramsSubscription = this.params$.subscribe(
      DynamicViewService.updateInputs(
        playground.componentInstance,
        this.componentFactoryResolver.resolveComponentFactory(PlaygroundComponent).inputs,
        new Set<string>(),
        () => playgroundCdr.detectChanges()
      )
    );
    return playground.result.finally(() => {
      paramsSubscription.unsubscribe();
    });
  }

  ngOnChanges({ params }: SimpleChanges) {
    if (params) {
      this.paramsChange$.next(params.currentValue);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
