import { Component, Input, isDevMode, } from '@angular/core';
import { isDataSource } from '@angular/cdk/collections';

import { Observable } from 'rxjs';
import { isString, isObject, size, isArray, isFunction } from 'lodash-es';

interface TreeNode {
  label?: string;
  value?: string | number | boolean | any;
  children?: Array<any> | object;
}

@Component({
  selector: 'app-object-explorer',
  templateUrl: './object-explorer.component.html'
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
    if (isObject(node) as any) {
      if (node.children) {
        return isArray(node.children) ? node.children : this.getChildren(node.children);
      }
      const filterPrivateProperties: (value: any) => boolean = isDevMode() ? () => true : ([label]) => label[0] !== '_';
      return Object.entries(node)
        // filter out internally used properties (not allowed in file)
        .filter(filterPrivateProperties)
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
            // @ts-ignore
            if (isString(value) && value.length > 20) {
              n.children = [
                value
              ];
            } else if (isFunction(value)) {
              n.children = value;
              n.value = isDevMode() ? String(value) : 'function';
            } else if (isObject(value)) {
              n.children = value;
            } else {
              n.children = [];
              n.value = value;
            }
          }
          return n;
        });
    }
  }

  hasChild(_, node: TreeNode) {
    return (
      typeof node === 'object'
    ) && (
      size(
        node.children ? node.children : Object.keys(node)
      ) > 0
    );
  }
}
