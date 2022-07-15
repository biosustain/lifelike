import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

import { Observable, defer, of, iif } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { Source, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { ViewService } from 'app/file-browser/services/view.service';
import { Tab } from 'app/shared/workspace-manager';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { CdkNativeDragItegration } from 'app/shared/utils/drag';
import { PdfViewComponent } from 'app/pdf-viewer/components/pdf-view.component';
import { MapComponent } from 'app/drawing-tool/components/map.component';

@Component({
  selector: 'app-workspace-tab',
  templateUrl: './workspace-tab.component.html',
  styleUrls: ['./workspace-tab.component.scss']
})
export class WorkspaceTabComponent implements OnChanges {
  @Input() active: boolean;
  @Input() tab: Tab;
  @Input() hasSiblings = false;
  @Input() scroll$: Observable<any>;
  @Output() clearWorkbench: EventEmitter<any> = new EventEmitter();
  @Output() closeAllTabs: EventEmitter<any> = new EventEmitter();
  @Output() closeOtherTabs: EventEmitter<any> = new EventEmitter();
  @Output() duplicate: EventEmitter<any> = new EventEmitter();
  @Output() tabClick: EventEmitter<any> = new EventEmitter();
  @Output() tabClose: EventEmitter<any> = new EventEmitter();

  fontAwesomeIconClass: string;


  constructor(
    protected readonly viewService: ViewService,
    protected readonly clipboard: ClipboardService
  ) {
  }

  dragData$ = defer(() => {
    this.tab.component?.sourceData$.pipe(
      switchMap(sources =>
        iif(
          () => Boolean(sources),
          of(sources),
          of( () => this.viewService.getShareableLink(this.tab.component, this.tab.url).pipe(
            map(url => [{
            url: url.href,
            domain: this.tab.title,
          } as Source])))
        )
      ),
      map(sources => {
        return { 'application/***ARANGO_DB_NAME***-node': JSON.stringify({
          display_name: this.tab.title,
          label: (this.tab.component as MapComponent)?.map ? 'map' : 'link',
          sub_labels: [],
          data: {
            sources
          }
        } as Partial<UniversalGraphNode>)};
      }));
  });

  drag = new CdkNativeDragItegration(this.dragData$);

  ngOnChanges({tab}: SimpleChanges) {
    if (tab) {
      this.fontAwesomeIconClass = this.calculateFontAwesomeIcon((tab.currentValue as Tab).fontAwesomeIcon);
    }
  }

  openCopyLinkDialog() {
    return this.clipboard.copy(
      this.viewService.getShareableLink(this.tab.component, this.tab.url).toPromise()
        .then((url) => {
          this.tab.url = url.pathname + url.search + url.hash;
          return url.href;
        }),
      {intermediate: 'Generating link...'}
    );
  }

  calculateFontAwesomeIcon(s: string) {
    if (s == null) {
      return 'window-maximize';
    } else if (s.includes(' ')) {
      return s;
    } else {
      return 'fa fa-' + s;
    }
  }
}
