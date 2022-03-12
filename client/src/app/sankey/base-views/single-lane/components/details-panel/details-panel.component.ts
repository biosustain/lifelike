import { Component, ViewEncapsulation, OnDestroy } from '@angular/core';

import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { SankeyAbstractDetailsPanelComponent } from '../../../../abstract/details-panel.component';
import { SankeySelectionService } from '../../../../services/selection.service';

@Component({
  selector: 'app-sankey-single-lane-details-panel',
  templateUrl: './details-panel.component.html',
  styleUrls: ['./details-panel.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SankeySingleLaneDetailsPanelComponent
  extends SankeyAbstractDetailsPanelComponent
  implements OnDestroy {
  constructor(
    protected selectionService: SankeySelectionService
  ) {
    super(selectionService);
    this.detailsSubscribtion = this.details$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(details => {
      this.detailView = details;
    });
  }

  destroy$ = new Subject();
  detailsSubscribtion: Subscription;
  detailView;

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
