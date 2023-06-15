import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

import { combineLatest, defer, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { compact, concat } from 'lodash-es';

import { Source, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { ViewService } from 'app/file-browser/services/view.service';
import { Tab } from 'app/shared/workspace-manager';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { CdkNativeDragItegration } from 'app/shared/utils/drag';
import { MapComponent } from 'app/drawing-tool/components/map.component';
import { GenericDataProvider } from 'app/shared/providers/data-transfer-data/generic-data.provider';
import { AppURL } from 'app/shared/utils/url';

@Component({
  selector: 'app-workspace-tab',
  templateUrl: './workspace-tab.component.html',
  styleUrls: ['./workspace-tab.component.scss'],
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
  ) {}

  dragData$ = defer(() =>
    combineLatest(
      compact([
        this.tab.component?.sourceData$,
        this.viewService.getShareableLink(this.tab.component, this.tab.url).pipe(
          map(({ href }) => [
            {
              url: href,
              domain: this.tab.title,
            } as Source,
          ])
        ),
      ])
    ).pipe(
      map((sources) => concat(...sources)),
      map((sources: Source[]) => ({
        'application/lifelike-node': JSON.stringify({
          display_name: this.tab.title,
          label: (this.tab.component as MapComponent)?.map ? 'map' : 'link',
          sub_labels: [],
          data: {
            sources,
          },
        } as Partial<UniversalGraphNode>),
        ...GenericDataProvider.getURIs(
          sources.map(({ url, domain }) => ({
            uri: AppURL.from(url).toAbsolute(),
            title: domain,
          }))
        ),
      }))
    )
  );

  drag = new CdkNativeDragItegration(this.dragData$);

  ngOnChanges({ tab }: SimpleChanges) {
    if (tab) {
      this.fontAwesomeIconClass = this.calculateFontAwesomeIcon(
        (tab.currentValue as Tab).fontAwesomeIcon
      );
    }
  }

  openCopyLinkDialog() {
    return this.clipboard.copy(
      this.viewService
        .getShareableLink(this.tab.component, this.tab.url)
        .toPromise()
        .then((url) => {
          this.tab.url = url.pathname + url.search + url.hash;
          return url.href;
        }),
      { intermediate: 'Generating link...' }
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
