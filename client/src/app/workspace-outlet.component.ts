import {
  AfterViewInit,
  ChangeDetectorRef,
  Component, EventEmitter,
  HostListener,
  Input, OnDestroy, Output,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { Container} from './shared/workspace-manager';

@Component({
  selector: 'app-workspace-outlet',
  template: `
    <ng-container #child></ng-container>`,
})
export class WorkspaceOutletComponent implements AfterViewInit, OnDestroy {
  @Input() name;
  @Output() outletFocus = new EventEmitter<any>();
  @ViewChild('child', {static: false, read: ViewContainerRef}) viewComponentRef: ViewContainerRef;
  private currentContainer: Container<any>;

  constructor(private changeDetectorRef: ChangeDetectorRef) {
  }

  ngOnDestroy(): void {
    this.viewComponentRef.detach(0);
  }

  get container() {
    return this.currentContainer;
  }

  @Input() set container(container) {
    this.currentContainer = container;
    this.attachComponent();
  }

  ngAfterViewInit(): void {
    this.attachComponent();
  }

  private attachComponent(): void {
    if (this.viewComponentRef) {
      this.viewComponentRef.detach(0);
      if (this.currentContainer) {
        this.currentContainer.attach(this.viewComponentRef);
        this.changeDetectorRef.detectChanges();
      }
    }
  }

  @HostListener('focusin')
  focusedInside() {
    this.outletFocus.emit();
  }

  @HostListener('click')
  clicked() {
    this.outletFocus.emit();
  }

}
