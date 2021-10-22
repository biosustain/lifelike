import { Component, OnDestroy } from '@angular/core';

import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

import { ModuleAwareComponent } from 'app/shared/modules';
import { SankeyLayoutService } from 'app/sankey-viewer/components/sankey/sankey-layout.service';
import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';
import { SankeyViewComponent } from 'app/sankey-viewer/components/sankey-view.component';

import { CustomisedSankeyManyToManyLayoutService } from '../services/customised-sankey-layout.service';
import { SankeyManyToManyControllerService } from '../services/sankey-controller.service';
import { SankeyManyToManySelection } from './interfaces';

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

  // @ts-ignore
  selection: BehaviorSubject<SankeyManyToManySelection>;

  initSelection() {
    this.selection = new BehaviorSubject(undefined);
    this.selectionWithTraces = this.selection.pipe(
      map((currentSelection) => {
        if (!currentSelection) {
          return [];
        }
        const {node, link} = (currentSelection as any);
        const traces = [
          ...this.sankeyController.getRelatedTraces({
            nodes: node ? [node] : [],
            links: link ? [link] : []
          })
        ].map(trace => ({
          trace
        } as SankeyManyToManySelection));
        return [currentSelection].concat(traces);
      })
    );
    this.selection.subscribe(selection => this.detailsPanel = !!selection);
  }

  emitModuleProperties() {
    super.emitModuleProperties();
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }


  toggleSelect(entity, type) {
    if (this.selection.value && (this.selection.value[type] === entity)) {
      this.selection.next(undefined);
    } else {
      this.selection.next({
        [type]: entity
      } as SankeyManyToManySelection);
    }
  }

  resetSelection() {
    const data = this.sankeyController.dataToRender.value;
    this.selection.next(undefined);
    data.nodes.forEach(n => {
      delete n._selected;
    });
    data.links.forEach(l => {
      delete l._selected;
    });
  }

}
