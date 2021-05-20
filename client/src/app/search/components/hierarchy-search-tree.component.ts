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
  @Output() pathSelectionChanged = new EventEmitter<string[]>();

  constructor() {
    super();
  }

  /**
   * Toggle a leaf item selection. DO NOT update parent state, since toggling all leaves (folders) of a parent DOES NOT mean the user
   * wants all files in the parent.
   * @param node the node to toggle
   */
  leafItemSelectionToggle(node: FlatNode<FileNodeData>): void {
    this.checklistSelection.toggle(node);
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
   * Generates a list of filepaths based on the currently selected items. If all children of a root are selected, and the root is selected,
   * only the root path is returned.
   */
   selectionChanged() {
    // Sort the list so that leaves appear before non-leaves. This allows us to
    // easily return only root paths if all children in the path are also selected.
    const selectedPaths = new Set<string>();
    this.checklistSelection.sort((a, b) => b.level - a.level);

    this.checklistSelection.selected.forEach(selectedNode => {
      const parentNode = this.getParentNode(selectedNode);
      if (parentNode !== null && this.checklistSelection.isSelected(parentNode)) {
        // If the parent is selected, then we can safely add its path to the list. We can also remove this node from the list, since it and
        // its children will still be included via the parent's path.
        selectedPaths.add(parentNode.data.filepath);
        selectedPaths.delete(selectedNode.data.filepath);
      } else {
        selectedPaths.add(selectedNode.data.filepath);
      }
    });

    this.pathSelectionChanged.emit(Array.from(selectedPaths));
  }
}
