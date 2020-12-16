import { Component, Input } from '@angular/core';
import { GraphEntity, GraphEntityType, UniversalGraphEdge, UniversalGraphNode } from '../services/interfaces';
import { openPotentialInternalLink } from '../../shared/utils/browser';
import { WorkspaceManager } from '../../shared/workspace-manager';

@Component({
  selector: 'app-info-view-panel',
  templateUrl: './info-view-panel.component.html',
})
export class InfoViewPanelComponent {

  @Input() selected: GraphEntity | undefined;

  constructor(protected readonly workspaceManager: WorkspaceManager) {
  }

  get isNode() {
    return this.selected.type === GraphEntityType.Node;
  }

  goToLink(url) {
    openPotentialInternalLink(this.workspaceManager, url, true);
  }

  goToSource(url): void {
    openPotentialInternalLink(this.workspaceManager, url, false);
  }

  get name(): string {
    if (this.selected.type === GraphEntityType.Node) {
      const node = this.selected.entity as UniversalGraphNode;
      return node.display_name;
    } else if (this.selected.type === GraphEntityType.Edge) {
      const edge = this.selected.entity as UniversalGraphEdge;
      return edge.label;
    } else {
      return '?unknown entity type?';
    }
  }

}
