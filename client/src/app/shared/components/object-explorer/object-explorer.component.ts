import { Component, Input, } from '@angular/core';
import { isDataSource } from '@angular/cdk/collections';
import { Observable } from 'rxjs';

interface TreeNode {
  label?: string;
  value?: string | number | boolean;
  children?: Array<any>;
}

@Component({
  selector: 'app-object-explorer',
  templateUrl: './object-explorer.component.html',
  styleUrls: ['./object-explorer.component.scss']
})
export class ObjectExplorerComponent {
  _dataSource;
  /**
   * Wrap input so we can rovide just singular node of interest in here
   */
  @Input() set dataSource(dataSource: {}) {
    if (isDataSource(dataSource) || (dataSource instanceof Observable) || (Array.isArray(dataSource))) {
      this._dataSource = dataSource;
    } else {
      this._dataSource = this.getChildren(dataSource);
    }
  }

  get dataSource() {
    return this._dataSource;
  }

  getChildren(node) {
    if (typeof node === 'object') {
      if (node.children) {
        return node.children;
      }
      return Object.entries(node)
        // filter out internally used properties (not allowed in file)
        .filter(([label]) => label[0] !== '_')
        .map(([label, value], index) => {
          const n = {
            label: label
              // camel case to normal text
              .replace(/([a-z])([A-Z])/g, (match, p1, p2) => `${p1} ${p2.toLowerCase()}`)
              // snake case to normal text
              .replace(/([a-z])_([a-z])/g, (match, p1, p2) => `${p1} ${p2}`)
          } as TreeNode;
          if (Array.isArray(value)) {
            n.children = value;
          } else {
            // if text is longer than 20 character show it as collapsible node
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
  };

  hasChild(node: TreeNode) {
    return (
      typeof node === 'object'
    ) && (
      (
        node.children ? node.children : Object.keys(node)
      ).length > 0
    );
  }
}
