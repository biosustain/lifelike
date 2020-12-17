import { Component, Input, OnInit, OnDestroy } from '@angular/core';

import { SidenavTypeEntity, NodeAssociatedTypesRequest } from 'app/interfaces';
import { VisualizationService } from 'app/visualization/services/visualization.service';
import { AssociatedType } from '../context-menu/context-menu.component';

@Component({
    selector: 'app-sidenav-type-view',
    templateUrl: './sidenav-type-view.component.html',
    styleUrls: ['./sidenav-type-view.component.scss']
})
export class SidenavTypeViewComponent implements OnInit, OnDestroy {
  @Input() legend: Map<string, string[]>;
  @Input() nodeEntity: SidenavTypeEntity;
  type: string;
  associatedType = AssociatedType;
  typeEntries: AssociatedTypeEntry[];
  color: string;

  constructor(private visualizationService: VisualizationService) {}

  ngOnInit() {
    switch (this.nodeEntity.type) {
      case (this.associatedType.CHEMICAL): {
        this.type = 'Chemical';
        break;
      }
      case (this.associatedType.GENE): {
        this.type = 'Gene';
        break;
      }
      case (this.associatedType.DISEASE): {
        this.type = 'Disease';
        break;
      }
    }
    const request: NodeAssociatedTypesRequest = {
      node_id: this.nodeEntity.data.id,
      to_label: this.type,
    };
    this.color = this.legend.get(this.type)[0];
    this.visualizationService.getAssociatedTypesForNode(request).subscribe((associatedTypes) => {
      this.typeEntries = [];
      const max = associatedTypes.length > 0 ? associatedTypes[0].snippetCount : 0;
      associatedTypes.forEach(associatedType => {
        const entry: AssociatedTypeEntry = {
          name: associatedType.name,
          count: associatedType.snippetCount,
          percentage: (associatedType.snippetCount / max) * 100,
        };
        this.typeEntries.push(entry);
      });
    });
  }

  ngOnDestroy() {

  }
}

interface AssociatedTypeEntry {
  name: string;
  count: number;
  percentage: number;
}
