import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';

import { Container } from 'app/shared/workspace-manager';

@Component({
  selector: 'app-workspace-outlet',
  template: `
    <ng-container #child></ng-container>`,
})
export class WorkspaceOutletComponent implements AfterViewInit, OnChanges, OnInit, OnDestroy {
  @Input() set container(container) {
    this._container = container;
    if (this.active) {
      this.attachComponent();
    }
  }

  get container() {
    return this._container;
  }

  @Input() set active(active: boolean) {
    this._active = active;
    if (active && !this.previouslyActive) {
      this.previouslyActive = true;
      this.attachComponent();
    }
  }

  get active(): boolean {
    return this._active;
  }

  @Input() name: string;
  @Output() outletFocus = new EventEmitter<any>();
  @ViewChild('child', {static: false, read: ViewContainerRef}) viewComponentRef: ViewContainerRef;

  private _active = false;
  private _container: Container<any>;
  private previouslyActive = false;

  constructor(private changeDetectorRef: ChangeDetectorRef,
              private ngZone: NgZone,
              private hostElement: ElementRef) {
  }

  ngOnInit() {
    this.ngZone.runOutsideAngular(() => {
      this.hostElement.nativeElement.addEventListener('focusin', this.focusedInside.bind(this), true);
      this.hostElement.nativeElement.addEventListener('click', this.focusedInside.bind(this), true);
    });
  }

  ngOnDestroy(): void {
    // Detach the viewRef from the componentRef. This allows us to move tabs around without reloading the associated component.
    this.viewComponentRef.detach();
  }

  ngAfterViewInit(): void {
    if (this.active) {
      this.attachComponent();
    }
  }

  ngOnChanges(): void {
    if (this.active && this.viewComponentRef && this.container && !this.container.attached) {
      this.attachComponent();
    }
  }

  private attachComponent(): void {
    if (this.viewComponentRef) {
      this.viewComponentRef.detach();
      if (this.container) {
        this.container.attach(this.viewComponentRef);
        this.changeDetectorRef.detectChanges();
      }
    }
  }

  focusedInside() {
    this.outletFocus.emit();
  }
}
