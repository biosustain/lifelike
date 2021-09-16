import { Component, OnDestroy } from '@angular/core';
import { ModuleAwareComponent } from 'app/shared/modules';
import { CustomisedSankeyManyToManyLayoutService } from '../services/customised-sankey-layout.service';
import { SankeyLayoutService } from '../../sankey-viewer/components/sankey/sankey-layout.service';
import { SankeyManyToManyControllerService } from '../services/sankey-controller.service';
import { SankeyControllerService } from '../../sankey-viewer/services/sankey-controller.service';
import { SankeyViewComponent } from '../../sankey-viewer/components/sankey-view.component';

@Component({
  selector: 'app-sankey-viewer',
  templateUrl: './sankey-view.component.html',
  styleUrls: [
    '../../sankey-viewer/components/sankey-view.component.scss',
    './sankey-view.component.scss'
  ],
  providers: [
    CustomisedSankeyManyToManyLayoutService, {
      provide: SankeyLayoutService,
      useExisting: CustomisedSankeyManyToManyLayoutService
    },
    SankeyManyToManyControllerService, {
      provide: SankeyControllerService,
      useExisting: SankeyManyToManyControllerService
    }
  ]
})
export class SankeyManyToManyViewComponent extends SankeyViewComponent implements OnDestroy, ModuleAwareComponent {
  emitModuleProperties() {
    super.emitModuleProperties();
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }

  toggleSelect(entity, type) {
    let currentSelection = this.selection.value;
    const idxOfSelectedLink = currentSelection.findIndex(
      d => d.type === type && d.entity === entity
    );

    if (idxOfSelectedLink !== -1) {
      currentSelection.splice(idxOfSelectedLink, 1);
    } else {
      currentSelection = currentSelection.filter(s => s.type !== type);
      currentSelection.push({
        type,
        entity
      });
    }

    this.selection.next(currentSelection);
  }
}
