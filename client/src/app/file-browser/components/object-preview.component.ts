import { AfterViewInit, Component, ComponentRef, Input, NgZone, ViewChild, ViewContainerRef } from '@angular/core';
import { FilesystemObject } from '../models/filesystem-object';
import { FilesystemService } from '../services/filesystem.service';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { ObjectTypeService } from '../services/object-type.service';
import { BehaviorSubject, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

@Component({
  selector: 'app-object-preview',
  templateUrl: './object-preview.component.html',
})
export class ObjectPreviewComponent {

  @ViewChild('child', {static: false, read: ViewContainerRef}) viewComponentRef: ViewContainerRef;

  private readonly object$ = new BehaviorSubject<FilesystemObject>(null);
  readonly previewComponent$ = this.object$.pipe(mergeMap(object => {
    if (object) {
      return this.objectTypeService.get(object).pipe(map(typeProvider => {
        return typeProvider.createPreviewComponent(object);
      }));
    } else {
      return of(null);
    }
  }));

  constructor(protected readonly filesystemService: FilesystemService,
              protected readonly errorHandler: ErrorHandler,
              protected readonly objectTypeService: ObjectTypeService,
              protected readonly ngZone: NgZone) {
  }

  @Input()
  set object(object: FilesystemObject | undefined) {
    this.object$.next(object);
  }

}

@Component({
  selector: 'app-object-preview-outlet',
  template: `
    <ng-container #child></ng-container>
  `,
})
export class ObjectPreviewOutletComponent implements AfterViewInit {

  @ViewChild('child', {static: false, read: ViewContainerRef}) viewComponentRef: ViewContainerRef;
  private _componentRef: ComponentRef<any>;

  @Input()
  set componentRef(componentRef: ComponentRef<any>) {
    this._componentRef = componentRef;
    if (this.viewComponentRef) {
      this.attach();
    }
  }

  get componentRef(): ComponentRef<any> {
    return this._componentRef;
  }

  ngAfterViewInit(): void {
    this.attach();
  }

  private attach() {
    // Run outside change detection
    // I don't think you're supposed to do it this way
    Promise.resolve(null).then(() => {
      this.viewComponentRef.clear();
      if (this.componentRef) {
        this.viewComponentRef.insert(this.componentRef.hostView);
      }
    });
  }

}
