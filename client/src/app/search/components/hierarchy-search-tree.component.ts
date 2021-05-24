import { Component, EventEmitter, Output } from '@angular/core';

import { isNullOrUndefined } from 'util';

import { MAP_MIMETYPE } from 'app/drawing-tool/providers/map.type-provider';
import { ENRICHMENT_TABLE_MIMETYPE } from 'app/enrichment/providers/enrichment-table.type-provider';
import { DIRECTORY_MIMETYPE } from 'app/file-browser/providers/directory.type-provider';
import { FileNodeData } from 'app/file-browser/schema';
import { PDF_MIMETYPE } from 'app/pdf-viewer/providers/pdf-type-provider';
import { ChecklistFlatTreeComponent } from 'app/shared/components/checklist-flat-tree/checklist-flat-tree.component';
import { FlatNode, TreeNode } from 'app/shared/schemas/common';

@Component({
  selector: 'app-hierarchy-search-tree',
  templateUrl: './hierarchy-search-tree.component.html',
  styleUrls: ['./hierarchy-search-tree.component.scss']
})
export class HierarchySearchTreeComponent extends ChecklistFlatTreeComponent<FileNodeData> {
  @Output() folderSelectionChanged = new EventEmitter<string[]>();

  constructor() {
    super();
  }

  /** Toggle item selection. Select/deselect all the descendants node */
  itemSelectionToggle(node: FlatNode<FileNodeData>): void {
    this.checklistSelection.toggle(node);

    // Node is a parent
    if (node.expandable) {
      // When a parent is selected, select all its children as well.
      const descendants = this.treeControl.getDescendants(node);
      this.checklistSelection.isSelected(node)
        ? this.checklistSelection.select(...descendants)
        : this.checklistSelection.deselect(...descendants);
    }

    // If this node was deselected, and it has a parent, then deselect the parent as well. It doesn't make sense for a parent to be
    // selected if any of its children are deselected.
    if (!this.checklistSelection.isSelected(node)) {
      const parent = this.getParentNode(node);
      if (parent !== null) {
        this.checklistSelection.deselect(this.getParentNode(node));
      }
    }
  }

  getIconForFileNode(node: TreeNode<FileNodeData>) {
    switch (node.data.mimeType) {
      case PDF_MIMETYPE:
        return 'fa-file-pdf';
      case ENRICHMENT_TABLE_MIMETYPE:
        return 'fa-table';
      case MAP_MIMETYPE:
        return 'fa-project-diagram';
      case DIRECTORY_MIMETYPE:
        if (!isNullOrUndefined(node.data.parent)) {
          return 'fa-folder';
        } else {
          return 'fa-layer-group';
        }
      default:
        return 'fa-file';
    }
  }

  /**
   * Generates a list of filepaths based on the currently selected items. If all children of a ***ARANGO_USERNAME*** are selected, and the ***ARANGO_USERNAME*** is selected,
   * only the ***ARANGO_USERNAME*** path is returned.
   */
   selectionChanged() {
    // Sort the list so that leaves appear before non-leaves. This allows us to
    // easily return only ***ARANGO_USERNAME*** paths if all children in the path are also selected.
    const selectedFolders = new Set<string>();
    this.checklistSelection.sort((a, b) => b.level - a.level);

    this.checklistSelection.selected.forEach(selectedNode => {
      const parentNode = this.getParentNode(selectedNode);
      if (parentNode !== null && this.checklistSelection.isSelected(parentNode)) {
        // If the parent is selected, then we can safely add its path to the list. We can also remove this node from the list, since it and
        // its children will still be included via the parent's path.
        selectedFolders.add(parentNode.data.hashId);
        selectedFolders.delete(selectedNode.data.hashId);
      } else {
        selectedFolders.add(selectedNode.data.hashId);
      }
    });

    this.folderSelectionChanged.emit(Array.from(selectedFolders));
  }
}
