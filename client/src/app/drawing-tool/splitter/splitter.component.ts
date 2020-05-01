import {
  Component,
  OnInit,
  ComponentFactoryResolver,
  ViewContainerRef,
  Injector,
  ViewChild,
  AfterViewInit,
  HostListener,
  ComponentRef
} from '@angular/core';

import {
  PdfViewerComponent
} from '../pdf-viewer/pdf-viewer.component';
import {
  MapListComponent
} from '../project-list-view/map-list/map-list.component';
import { Observable } from 'rxjs';
import { LaunchApp } from '../services/interfaces';

@Component({
  selector: 'app-splitter',
  templateUrl: './splitter.component.html',
  styleUrls: ['./splitter.component.scss']
})
export class SplitterComponent implements OnInit, AfterViewInit {
  @ViewChild(
    'leftPanel',
    {static: false, read: ViewContainerRef}
  ) leftPanel: ViewContainerRef;

  splitPanelLength = 0;

  currentApp = '';

  saveState = true;

  dynamicComponentRef: ComponentRef<any>;

  constructor(
    private injector: Injector,
    private r: ComponentFactoryResolver
  ) { }

  ngOnInit() {

  }

  ngAfterViewInit() {

  }

  @HostListener('window:beforeunload')
  canDeactivate(): Observable<boolean> | boolean {
    return this.saveState ? true : confirm(
        'WARNING: You have unsaved changes. Press Cancel to go back and save these changes, or OK to lose these changes.'
    );
  }

  resolveSaveState(saveState: boolean) {
    this.saveState = saveState;
  }

  /**
   *
   */
  close() {
    this.currentApp = '';
    this.leftPanel.clear();
    this.splitPanelLength = 0;
  }

  /**
   *
   * @param app - app such as pdf-viewer or kg-visualizer
   */
  openApp(appCmd: LaunchApp) {
    if (!appCmd) {
      this.close();
      return;
    }

    // Don't waste time trying to re-open the app
    // if it's already opened
    if (this.currentApp !== appCmd.app) {
      let factory;

      switch (appCmd.app) {
        case 'map-search':
          factory = this.r.resolveComponentFactory(MapListComponent);
          this.splitPanelLength = 30;
          break;
        case 'pdf-viewer':
          factory = this.r.resolveComponentFactory(PdfViewerComponent);
          this.splitPanelLength = 50;
          break;
        default:
          break;
      }

      this.leftPanel.clear();
      this.currentApp = appCmd.app;

      this.dynamicComponentRef = this.leftPanel.createComponent(factory);
      this.dynamicComponentRef.changeDetectorRef.detectChanges();
    }

    // If an argument is supplied, inject into dynamic component
    if (this.currentApp === 'pdf-viewer' && appCmd.arg !== null) {
      this.dynamicComponentRef.instance.openPdf(
        appCmd.arg.fileId,
        {
          coords: appCmd.arg.coords,
          pageNumber: appCmd.arg.pageNumber
        }
      );
    }
  }
}
