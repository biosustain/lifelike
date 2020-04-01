import {
  Component,
  OnInit,
  ComponentFactoryResolver,
  ViewContainerRef,
  Injector,
  ViewChild
} from '@angular/core';

import {
  PdfViewerComponent
} from '../pdf-viewer/pdf-viewer.component';
import {
  MapSearchChannelComponent
} from '../map-search-channel/map-search-channel.component';

@Component({
  selector: 'app-splitter',
  templateUrl: './splitter.component.html',
  styleUrls: ['./splitter.component.scss']
})
export class SplitterComponent implements OnInit {
  @ViewChild(
    'leftPanel',
    {static: false, read: ViewContainerRef}
  ) leftPanel: ViewContainerRef;

  splitPanelLength = 0;

  constructor(
    private injector: Injector,
    private r: ComponentFactoryResolver
  ) { }

  ngOnInit() {

  }

  ngAfterViewInit() {

  }

  openApp(app:string) {
    let factory;
    let ref;

    switch(app) {
      case 'map-search':
        factory = this.r.resolveComponentFactory(MapSearchChannelComponent);
        ref = this.leftPanel.createComponent(factory);
        ref.changeDetectorRef.detectChanges();
        break;
      case 'pdf-viewer':
        factory = this.r.resolveComponentFactory(PdfViewerComponent);
        ref = this.leftPanel.createComponent(factory);
        ref.changeDetectorRef.detectChanges();
        break;
      default:
        break;
    }
  }
}
