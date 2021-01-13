import { Component, Input } from '@angular/core';
import { VisNode } from 'app/interfaces';

import {
  AssociatedType,
  AssociatedTypeEntry,
  NodeAssociatedTypesRequest,
  SidenavTypeEntity,
} from 'app/interfaces/visualization.interface';
import { VisualizationService } from 'app/visualization/services/visualization.service';


@Component({
    selector: 'app-sidenav-type-view',
    templateUrl: './sidenav-type-view.component.html',
    styleUrls: ['./sidenav-type-view.component.scss']
})
export class SidenavTypeViewComponent {
  @Input() legend: Map<string, string[]>;
  @Input() set nodeEntity(entity: SidenavTypeEntity) {
    console.log(entity);
    this.updateNodeEntity(entity);
  }

  node: VisNode;
  type: string;
  associatedType = AssociatedType;
  typeEntries: AssociatedTypeEntry[];
  color: string;

  loading = true;

  constructor(private visualizationService: VisualizationService) {}

  updateNodeEntity(nodeEntity: SidenavTypeEntity) {
    this.loading = true;
    this.node = nodeEntity.data;
    this.type = AssociatedType[nodeEntity.type];

    const request: NodeAssociatedTypesRequest = {
      node_id: this.node.id,
      // TODO: Should consider calling this just 'label', if the query doesn't care about direction
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
      this.loading = false;
    });
  }
}
