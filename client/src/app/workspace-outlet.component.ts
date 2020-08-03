import {
  AfterViewInit,
  ChangeDetectorRef,
  Component, EventEmitter,
  HostListener,
  Input, OnDestroy, Output,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { Container } from './shared/workspace-manager';

@Component({
  selector: 'app-workspace-outlet',
  template: `
    <ng-container #child></ng-container>`,
})
export class WorkspaceOutletComponent implements AfterViewInit, OnDestroy {
  @Input() name: string;
  @Output() outletFocus = new EventEmitter<any>();
  @ViewChild('child', {static: false, read: ViewContainerRef}) viewComponentRef: ViewContainerRef;
  private currentActive = false;
  private previouslyActive = false;
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
    if (this.active) {
      this.attachComponent();
    }
  }

  get active(): boolean {
    return this.currentActive;
  }

  @Input() set active(active: boolean) {
    this.currentActive = active;
    if (active && !this.previouslyActive) {
      this.previouslyActive = true;
      this.attachComponent();
    }
  }

  ngAfterViewInit(): void {
    if (this.active) {
      this.attachComponent();
    }
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
