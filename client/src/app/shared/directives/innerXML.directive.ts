import {
  AfterViewInit,
  Directive,
  ElementRef,
  Injector,
  Input,
  OnChanges,
  SimpleChanges,
  ViewContainerRef,
  ComponentFactoryResolver,
  ComponentFactory,
  ApplicationRef,
} from "@angular/core";

import { isString, find } from "lodash-es";

import {
  HIGHLIGHT_TEXT_TAG_HANDLER,
  XMLTag,
} from "../services/highlight-text.service";
import { ModalBodyComponent } from "../components/modal/modal-body.component";
import { findEntriesValue } from "../utils";

/**
 * Build 'appInnerXML' tag which is meant to act same as 'innerHTML' just for our XML tags
 */
@Directive({
  selector: "[appInnerXML]",
})
export class InnerXMLDirective implements OnChanges {
  static parser = new DOMParser();

  constructor(
    private readonly viewContainerRef: ViewContainerRef,
    private readonly injector: Injector,
    private readonly componentFactoryResolver: ComponentFactoryResolver,
    private app: ApplicationRef
  ) {}

  private node: Node = null;

  @Input("appInnerXML") innerXML: string | XMLDocument | Node;

  ngOnChanges({ innerXML }: SimpleChanges) {
    if (innerXML) {
      this.update(innerXML.currentValue);
    }
  }

  private getNode(innerXML: string | XMLDocument | Node) {
    if (isString(innerXML)) {
      return InnerXMLDirective.parser.parseFromString(innerXML, "text/xml")
        .documentElement;
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

  private mapChildNode(node: Node): Node {
    const xmlTagFactory = this.mapNodeToXMLTagFactory(node);
    if (xmlTagFactory) {
      const componentRef = xmlTagFactory.componentFactory.create(
        this.injector,
        [
          Array.from(node.childNodes).map((childNode) =>
            this.mapChildNode(childNode)
          ),
        ]
      );
      // Attach the view to the ApplicationRef so that you get change detection & host bindings
      this.app.attachView(componentRef.hostView);
      this.loadNodeAtributesToComponentInstance(
        node,
        xmlTagFactory.attributes,
        componentRef.instance
      );
      return componentRef.location.nativeElement;
    } else {
      return node;
    }
  }

  private loadNodeAtributesToComponentInstance(
    node: Node,
    xmlTagAttributes: string[],
    componentInstance: XMLTag
  ) {
    if (node instanceof Element) {
      Array.from(node.attributes)
        .filter(
          (attr) => attr.specified && xmlTagAttributes.includes(attr.name)
        )
        .forEach((attr) => {
          componentInstance[attr.name] = attr.value;
        });
    }
    componentInstance.update();
  }

  public update(innerXML: string | XMLDocument | Node) {
    const newNode = this.getNode(innerXML);
    if (!newNode.isEqualNode(this.node)) {
      this.node = newNode;
      const xmlTagFactory = this.mapNodeToXMLTagFactory(newNode);
      if (xmlTagFactory) {
        this.viewContainerRef.clear();
        const componentRef = this.viewContainerRef.createComponent(
          xmlTagFactory.componentFactory,
          0,
          this.injector,
          [
            Array.from(newNode.childNodes).map((childNode) =>
              this.mapChildNode(childNode)
            ),
          ]
        );
        this.loadNodeAtributesToComponentInstance(
          newNode,
          xmlTagFactory.attributes,
          componentRef.instance
        );
      }
    }
  }
}
