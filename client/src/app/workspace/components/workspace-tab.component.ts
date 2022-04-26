import { CdkDragMove, CdkDragRelease } from '@angular/cdk/drag-drop';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

import { isNil } from 'lodash';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';

import { Source, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { ViewService } from 'app/file-browser/services/view.service';
import { Tab } from 'app/shared/workspace-manager';
import { CopyLinkDialogComponent } from 'app/shared/components/dialog/copy-link-dialog.component';

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
  lastTabDragTarget: Element = null;

  constructor(
    protected readonly modalService: NgbModal,
    protected readonly viewService: ViewService,
  ) {}

  ngOnChanges({tab}: SimpleChanges) {
    if (tab) {
      this.fontAwesomeIconClass = this.calculateFontAwesomeIcon((tab.currentValue as Tab).fontAwesomeIcon);
    }
  }

  openCopyLinkDialog() {
    const modalRef = this.modalService.open(CopyLinkDialogComponent);
    modalRef.componentInstance.url = 'Generating link...';
    const urlSubscription = this.viewService.getShareableLink(
      this.tab.getComponent(), this.tab.url
    ).subscribe((url) => {
      this.tab.url = url.pathname + url.search + url.hash;
      modalRef.componentInstance.url = url.href;
    });
    // todo: use hidden after update of ng-bootstrap >= 8.0.0
    // https://ng-bootstrap.github.io/#/components/modal/api#NgbModalRef
    modalRef.result.then(
      () => urlSubscription.unsubscribe(),
      () => urlSubscription.unsubscribe()
    );
    return modalRef.result;
  }

  cdkDragMoved($event: CdkDragMove) {
    const dragTarget = document.elementFromPoint($event.pointerPosition.x, $event.pointerPosition.y);
    if (dragTarget !== this.lastTabDragTarget) {
      if (!isNil(this.lastTabDragTarget)) {
        const synthDragLeaveEvent = new DragEvent('dragleave');
        this.lastTabDragTarget.dispatchEvent(synthDragLeaveEvent);
      }
      const synthDragEnterEvent = new DragEvent('dragenter');
      dragTarget.dispatchEvent(synthDragEnterEvent);
      this.lastTabDragTarget = dragTarget;
    }
  }

  cdkDragReleased($event: CdkDragRelease<Tab>) {
    const dropRect = document.getElementsByClassName('cdk-drag-preview')[0].getBoundingClientRect();
    const dropTarget = document.elementFromPoint(dropRect.x + (dropRect.width / 2), dropRect.y + (dropRect.height / 2));
    const synthDropEvent = new DragEvent('drop', {dataTransfer: new DataTransfer()});

    const sources: Source[] = [{
      domain: this.tab.title,
      url: this.tab.url
    }];

    const doi = this.tab.getComponent()?.object?.doi;
    if (doi) {
      sources.push({domain: 'DOI', url: doi});
    }

    this.viewService.getShareableLink(
      this.tab.getComponent(), this.tab.url
    ).subscribe((url) => {
      this.tab.url = url.pathname + url.search + url.hash;
      synthDropEvent.dataTransfer.effectAllowed = 'all';
      synthDropEvent.dataTransfer.setData('application/***ARANGO_DB_NAME***-node', JSON.stringify({
        display_name: this.tab.title,
        label: 'link',
        sub_labels: [],
        data: {
          sources
        }
      } as Partial<UniversalGraphNode>));
      dropTarget.dispatchEvent(synthDropEvent);
    });
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
