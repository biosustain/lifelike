import {
  ComponentFactory,
  ComponentFactoryResolver,
  ComponentRef,
  Directive,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewContainerRef,
} from '@angular/core';

import { find, isString } from 'lodash-es';
import { ReplaySubject, Subject } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

import { DynamicViewService } from '../../../services/dynamic-view.service';
import { HIGHLIGHT_TEXT_TAG_HANDLER, XMLTag } from '../services/highlight-text.service';

interface NodeRef {
  node: Node;
}

interface XMLTagRef<Child = any> extends NodeRef {
  componentRef: ComponentRef<XMLTag>;
  children: Child[];
}

type NodeOrXMLTagRef = NodeRef | XMLTagRef<NodeOrXMLTagRef>;

type CreateComponentRef<T extends XMLTag> = (
  componentFactory: ComponentFactory<T>,
  projectableNodes?: any[][]
) => ComponentRef<T>;

/**
 * Build 'appInnerXML' tag which is meant to act same as 'innerHTML' just for our XML tags
 */
@Directive({
  selector: '[appInnerXML]',
})
export class InnerXMLDirective implements OnChanges, OnDestroy {
  static parser = new DOMParser();

  constructor(
    private readonly viewContainerRef: ViewContainerRef,
    private readonly injector: Injector,
    private readonly componentFactoryResolver: ComponentFactoryResolver
  ) {}

  private node$: Subject<Node> = new ReplaySubject(1);
  private updateSubscription = this.node$
    .pipe(distinctUntilChanged((prev, next) => prev.isEqualNode(next)))
    .subscribe((node) => {
      this.viewContainerRef.clear();
      return this.nodeToXMLTagRef(node, (componentFactory, projectableNodes) =>
        this.viewContainerRef.createComponent(componentFactory, 0, this.injector, projectableNodes)
      );
    });

  @Input('appInnerXML') innerXML: string | XMLDocument | Node;

  ngOnChanges({ innerXML }: SimpleChanges) {
    if (innerXML) {
      this.node$.next(this.getNode(innerXML.currentValue));
    }
  }

  ngOnDestroy() {
    this.updateSubscription?.unsubscribe();
  }

  private getNode(innerXML: string | XMLDocument | Node) {
    if (isString(innerXML)) {
      return InnerXMLDirective.parser.parseFromString(innerXML, 'text/xml').documentElement;
    }
    if (innerXML instanceof XMLDocument) {
      return innerXML.documentElement;
    }
    return innerXML;
  }

  private mapNodeToXMLTagFactory(node: Node): {
    componentFactory: ComponentFactory<XMLTag>;
    attributes: string[];
  } {
    const tagName = node.nodeName;
    const tags = this.injector.get(HIGHLIGHT_TEXT_TAG_HANDLER);
    const xmlTagMapping = find(tags, ({ tag }) => tag === tagName);
    if (xmlTagMapping) {
      return {
        componentFactory: this.componentFactoryResolver.resolveComponentFactory(
          xmlTagMapping.component
        ),
        attributes: xmlTagMapping.attributes,
      };
    }
  }

  private nodeToXMLTagRef(
    node: Node,
    creator: CreateComponentRef<XMLTag> = (componentFactory, projectableNodes) =>
      componentFactory.create(this.injector, projectableNodes)
  ): NodeOrXMLTagRef {
    const xmlTagFactory = this.mapNodeToXMLTagFactory(node);
    if (xmlTagFactory) {
      const children = Array.from(node.childNodes).map((childNode) =>
        this.nodeToXMLTagRef(childNode)
      );
      const componentRef = DynamicViewService.hookComponentRef(
        creator(xmlTagFactory.componentFactory, [
          children.map(
            (child) => (child as XMLTagRef).componentRef?.location.nativeElement ?? child.node
          ),
        ]),
        xmlTagFactory.componentFactory,
        this.parseNodeAtributesToComponentInputs(node, xmlTagFactory.attributes)
      );
      return {
        node,
        componentRef,
        children,
      };
    }
    return { node };
  }

  private parseNodeAtributesToComponentInputs(node: Node, xmlTagAttributes: string[]) {
    if (node instanceof Element) {
      return Object.fromEntries(
        Array.from(node.attributes)
          .filter((attr) => attr.specified && xmlTagAttributes.includes(attr.name))
          .map((attr) => [attr.name, attr.value])
      );
    }
  }
}
