import {
  ChangeDetectorRef,
  ComponentFactoryResolver,
  ComponentRef,
  Injectable,
  ViewContainerRef, ViewRef,
} from '@angular/core';
import { ComponentType } from '@angular/cdk/overlay';

import { defer as _defer } from 'lodash/fp';
import { Observable } from 'rxjs';

@Injectable()
export class DynamicViewService {
  constructor(
    private readonly componentFactoryResolver: ComponentFactoryResolver,
  ) {
  }

  public detach(viewRef: ViewContainerRef, componentRef: ComponentRef<any>): ViewRef | null {
    const index = viewRef.indexOf(componentRef.hostView);
    if (index !== -1) {
      return viewRef.detach(index);
    }
  }

  public insert(viewRef: ViewContainerRef, componentRef: ComponentRef<any>, index?: number): ViewRef {
    return viewRef.insert(componentRef.hostView, index);
  }

  public createComponent<T>(viewRef: ViewContainerRef, component: ComponentType<T>, inputs$?: Observable<Partial<T>>): ComponentRef<T> {
    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(component);
    const componentRef = viewRef.createComponent(componentFactory);
    if (inputs$) {
      const inputsSyncSubscription = inputs$.subscribe(
        (inputs) => {
          console.log("inputs change", componentRef.instance, inputs);
          Object.assign(componentRef.instance, inputs);
          const cdr1 = componentRef.changeDetectorRef;
          const cdr2 = componentRef.injector.get(ChangeDetectorRef);
          const cdr3 = componentRef.instance.cdr;
          console.log(cdr1 === cdr2, cdr1, cdr2);
          console.log(cdr1 === cdr3, cdr1, cdr3);
          cdr1.markForCheck();
          cdr2.markForCheck();
          cdr3.markForCheck();
          cdr1.detectChanges();
          cdr2.detectChanges()
          cdr3.detectChanges()
          _defer(() => cdr1.detectChanges());
          _defer(() => cdr2.detectChanges());
          _defer(() => cdr3.detectChanges());
        });
      componentRef.onDestroy = () => inputsSyncSubscription.unsubscribe();
    }
    return componentRef;
  }
}
