import {
  Component,
  OnInit,
  ComponentFactoryResolver,
  ViewContainerRef,
  Injector,
  ViewChild,
  AfterViewInit
} from '@angular/core';

import {
  PdfViewerComponent
} from '../pdf-viewer/pdf-viewer.component';
import {
  MapSearchChannelComponent
} from '../map-search-channel/map-search-channel.component';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-splitter',
  templateUrl: './splitter.component.html',
  styleUrls: ['./splitter.component.scss']
})
export class SplitterComponent implements OnInit, AfterViewInit {
  // TODO: Fix this ..
  // @HostListener('window:beforeunload')
  // canDeactivate(): Observable<boolean> | boolean {
  //   return this.saveState ? true : confirm(
  //       'WARNING: You have unsaved changes. Press Cancel to go back and save these changes, or OK to lose these changes.'
  //   );
  // }

  @ViewChild(
    'leftPanel',
    {static: false, read: ViewContainerRef}
  ) leftPanel: ViewContainerRef;

  splitPanelLength = 0;

  currentApp = '';

  constructor(
    private injector: Injector,
    private r: ComponentFactoryResolver
  ) { }

  ngOnInit() {

  }

  ngAfterViewInit() {

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
  openApp(app: string) {
    if (!app) {
      this.close();
      return;
    }

    let factory;
    let ref;

    switch (app) {
      case 'map-search':
        factory = this.r.resolveComponentFactory(MapSearchChannelComponent);
        break;
      case 'pdf-viewer':
        factory = this.r.resolveComponentFactory(PdfViewerComponent);
        break;
      default:
        break;
    }

    this.leftPanel.clear();
    this.splitPanelLength = 50;
    this.currentApp = app;

    ref = this.leftPanel.createComponent(factory);
    ref.changeDetectorRef.detectChanges();
  }
}
