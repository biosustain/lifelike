import { Component, ComponentFactoryResolver, Injector, Input, OnDestroy } from '@angular/core';

import { defer, ReplaySubject, Subject } from 'rxjs';
import { startWith, takeUntil } from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { PlaygroundComponent } from 'app/playground/components/playground.component';
import { openModal } from 'app/shared/utils/modals';
import { DynamicViewService } from 'app/shared/services/dynamic-view.service';

import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-open-playground',
  templateUrl: './open-playground.component.html',
})
export class OpenPlaygroundComponent implements OnDestroy {
  constructor(
    private readonly modalService: NgbModal,
    private readonly componentFactoryResolver: ComponentFactoryResolver,
    private readonly injector: Injector,
  ) {
  }

  private readonly destroy$ = new Subject();
  @Input() params!: Record<string, any>;
  private readonly paramsChange$ = new ReplaySubject(1);
  private readonly params$ = defer(() =>
    this.paramsChange$.pipe(startWith(this.params), takeUntil(this.destroy$)),
  );

  showPlayground = environment.chatGPTPlaygroundEnabled;

  openPlayground() {
    const playground = openModal(
      this.modalService,
      PlaygroundComponent,
      {
        size: 'xl',
        injector: this.injector,
      }
    );
    const paramsSubscription = this.params$.subscribe(
      DynamicViewService.updateInputs(
        playground.componentInstance,
        this.componentFactoryResolver.resolveComponentFactory(PlaygroundComponent).inputs,
        new Set<string>(),
        () => playground.componentInstance.cdr.detectChanges(),
      ),
    );
    return playground.result.finally(() => {
      paramsSubscription.unsubscribe();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
