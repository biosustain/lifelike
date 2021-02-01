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

  searchMapNodeInVisualizer(node) {
    // TODO: This is a temp fix to make searching compoounds/species easier. Sometime in the future it's expected that these types will be
    // squashed down into a single type.
    let entityType = node.label;

    if (entityType === 'compound') {
      entityType = 'chemical';
    } else if (entityType === 'species') {
      entityType = 'taxonomy';
    }

    this.workspaceManager.navigate(['/search'], {
      queryParams: {
        q: node.display_name,
        page: 1,
        entities: entityType,
        domains: '',
        organism: ''
      },
      sideBySide: true,
      newTab: true,
    });
  }

  searchMapNodeInContent(node) {
    this.workspaceManager.navigate(['/search/content'], {
      queryParams: {
        q: node.display_name,
        types: 'map;pdf',
        limit: 20,
        page: 1
      },
      sideBySide: true,
      newTab: true,
    });
  }
}
