import { CdkDragMove, CdkDragRelease } from '@angular/cdk/drag-drop';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

import { isNil } from 'lodash';
import { Observable, defer, of } from 'rxjs';

import { Source, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { ViewService } from 'app/file-browser/services/view.service';
import { Tab } from 'app/shared/workspace-manager';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { CdkNativeDragItegration } from 'app/shared/utils/drag';

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

  dragData$ = defer(() =>
    this.viewService.getShareableLink(
      this.tab.getComponent(), this.tab.url
    ).toPromise().then(url => {
      const sources: Source[] = [];

      const doi = this.tab.getComponent()?.object?.doi;
      if (doi) {
        sources.push({domain: 'DOI', url: doi});
      }
      return {
        'application/***ARANGO_DB_NAME***-node': JSON.stringify({
          display_name: this.tab.title,
          label: this.tab.getComponent()?.map ? 'map' : 'link',
          sub_labels: [],
          data: {
            sources: [
              ...sources,
              {
                domain: this.tab.title,
                url
              }
            ]
          }
        } as Partial<UniversalGraphNode>)
      };
    }));

  drag = new CdkNativeDragItegration(this.dragData$);

  ngOnChanges({tab}: SimpleChanges) {
    if (tab) {
      this.fontAwesomeIconClass = this.calculateFontAwesomeIcon((tab.currentValue as Tab).fontAwesomeIcon);
    }
  }

  openCopyLinkDialog() {
    return this.clipboard.copy(
      this.viewService.getShareableLink(this.tab.getComponent(), this.tab.url).toPromise()
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
