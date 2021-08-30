import { Component, Input, ViewEncapsulation, } from '@angular/core';
import { NestedTreeControl } from '@angular/cdk/tree';

interface TreeNode {
  label?: string;
  value?: string|number|boolean;
  children?: Array<any>;
}

@Component({
  selector: 'app-tree-view',
  templateUrl: './tree-view.component.html',
  styleUrls: ['./tree-view.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class TreeViewComponent {
  @Input() dataSource;

  treeControl = new NestedTreeControl<TreeNode>(node => {
    if (typeof node === 'object') {
      if (node.children) {
        return node.children;
      }
      return Object.entries(node)
        .filter(([label]) => label[0] !== '_')
        .map(([label, value], index) => {
        const n = {
          label: label
            .replace(/([a-z])([A-Z])/g, (match, p1, p2) => `${p1} ${p2.toLowerCase()}`)
            .replace(/([a-z])_([a-z])/g, (match, p1, p2) => `${p1} ${p2}`)
        } as TreeNode;
        if (Array.isArray(value)) {
          n.children = value;
        } else {
          if (value.length > 20 || (typeof value === 'object')) {
            n.children = [
              value
            ];
          } else {
            n.children = [];
            n.value = value;
          }
        }
        return n;
      });
    }
  });

  hasChild(_: number, node: TreeNode) {
    return (
      typeof node === 'object'
    ) && (
      (
        node.children ? node.children : Object.keys(node)
      ).length > 0
    );
  }
}
