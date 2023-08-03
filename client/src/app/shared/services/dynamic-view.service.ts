import { ComponentType } from '@angular/cdk/overlay';
import {
  ChangeDetectorRef,
  ComponentFactoryResolver,
  ComponentRef,
  Injectable,
  OnChanges,
  SimpleChange,
  SimpleChanges,
  ViewContainerRef,
  ViewRef,
} from '@angular/core';

import { reduce as _reduce, flow as _flow, isEmpty as _isEmpty } from 'lodash/fp';
import { isObservable, Observable } from 'rxjs';

export interface DynamicComponentRef<ComponentInterface> {
  componentRef?: ComponentRef<ComponentInterface>;
}

@Injectable()
export class DynamicViewService {
  constructor(private readonly componentFactoryResolver: ComponentFactoryResolver) {}

  /**
   * Creates function that updates inputs of componentRef
   * This implementation:
   * + takes into account only "inputs" that are defined in componentFactory
   * + calls ngOnChanges with SimpleChanges
   * + calls ChangeDetectorRef.detectChanges
   * @param componentRef - component reference
   * @param inputsDefinitions - list of inputs definitions
   * @param changed - set of already changed inputs
   * @private
   */
  static updateInputs<T>(
    componentInstance: T,
    inputsDefinitions: { propName: string; templateName: string }[],
    changed: Set<string>,
    changeCallback?: (changes: SimpleChanges) => void,
  ): (inputs: Partial<T>) => void {
    return (inputs) => {
      // Calculate changes and set input values as side effect
      const changes = _reduce((result, { propName, templateName }) => {
        if (templateName in inputs) {
          const prev = componentInstance[propName];
          const next = inputs[templateName];
          if (prev !== next) {
            result[templateName] = new SimpleChange(prev, next, changed.has(templateName));
            componentInstance[propName] = next;
            changed.add(templateName);
          }
        }
        return result;
      }, {} as SimpleChanges)(inputsDefinitions);
      (componentInstance as Partial<OnChanges>).ngOnChanges?.(changes);
      changeCallback?.(changes);
    };
  }

  public detach(viewRef: ViewContainerRef, componentRef: ComponentRef<any>): ViewRef | null {
    const index = viewRef.indexOf(componentRef.hostView);
    if (index !== -1) {
      return viewRef.detach(index);
    }
  }

  public insert(
    viewRef: ViewContainerRef,
    componentRef: ComponentRef<any>,
    index?: number
  ): ViewRef {
    return viewRef.insert(componentRef.hostView, index);
  }

  public createComponent<T>(
    viewRef: ViewContainerRef,
    component: ComponentType<T>,
    inputs: Partial<T> | Observable<Partial<T>> = {}
  ): ComponentRef<T> {
    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(component);
    const componentRef = viewRef.createComponent(componentFactory);
    const componentCdr = componentRef.injector.get(ChangeDetectorRef);
    const updateInputs = DynamicViewService.updateInputs(
      componentRef,
      componentFactory.inputs,
      new Set<string>(),
      () => componentCdr.detectChanges()
    );
    if (isObservable(inputs)) {
      // Subscribe to inputs changes
      const inputsSyncSubscription = inputs.subscribe(updateInputs);
      componentRef.onDestroy = () => inputsSyncSubscription.unsubscribe();
    } else {
      // Set initial inputs - updates will be not handled
      updateInputs(inputs);
    }
    return componentRef;
  }
}
