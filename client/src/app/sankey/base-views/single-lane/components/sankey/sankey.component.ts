import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";

import { first, map, publish, switchMap, takeUntil, tap } from "rxjs/operators";
import { combineLatest, forkJoin, iif, Observable, of, zip } from "rxjs";
import { isEmpty, isNumber } from "lodash-es";

import { isNotEmpty, mapIterable } from "app/shared/utils";
import { LayoutService } from "app/sankey/services/layout.service";
import { ClipboardService } from "app/shared/services/clipboard.service";
import { SankeySelectionService } from "app/sankey/services/selection.service";
import { SankeySearchService } from "app/sankey/services/search.service";
import { debug } from "app/shared/rxjs/debug";
import { SelectionEntity, SelectionType } from "app/sankey/interfaces/selection";
import { WarningControllerService } from "app/shared/services/warning-controller.service";
import { SankeyAbstractComponent } from "app/sankey/abstract/sankey.component";

import { SingleLaneLayoutService } from "../../services/single-lane-layout.service";
import { EntityType } from "../../../../interfaces/search";
import { EditService } from "../../../../services/edit.service";
import { Base } from "../../interfaces";

type SankeyEntity = Base["node"] | Base["link"];

@Component({
  selector: "app-sankey-single-lane",
  templateUrl: "../../../../abstract/sankey.component.svg",
  styleUrls: ["./sankey.component.scss"],
  encapsulation: ViewEncapsulation.None,
  providers: [
    SingleLaneLayoutService,
    {
      provide: LayoutService,
      useExisting: SingleLaneLayoutService,
    },
  ],
})
export class SankeySingleLaneComponent
  extends SankeyAbstractComponent<Base>
  implements OnInit, AfterViewInit, OnDestroy
{
  focusedLink$ = this.search.searchFocus$.pipe(
    map((searchFocus) => searchFocus?.type === EntityType.Link && searchFocus?.id),
    debug("focusedLink$"),
    switchMap((id) =>
      this.sankey.graph$.pipe(
        first(),
        // map graph file link to sankey link
        map(
          ({ links }) =>
            isNumber(id) &&
            // allow string == number match interpolation ("58" == 58 -> true)
            // tslint:disable-next-line:triple-equals
            (links as Base["link"][]).find((link) => link.id == id)
        ),
        tap((current) => isNotEmpty(current) && this.panToLink(current)),
        map(() => id)
      )
    ),
    switchMap((id) =>
      this.renderedLinks$.pipe(
        tap((renderedLinks) => {
          if (!isNumber(id)) {
            renderedLinks.attr("focused", undefined);
          } else {
            // allow string == number match interpolation ("58" == 58 -> true)
            renderedLinks
              // tslint:disable-next-line:triple-equals
              .attr("focused", (link) => link.id == id)
              // tslint:disable-next-line:triple-equals
              .filter((link) => link.id == id)
              .raise();
          }
        })
      )
    )
  );
  $getConnectedNodesAndLinks = switchMap((data: SankeyEntity) => {
    if (!data) {
      return of({ nodesIds: new Set(), linksIds: new Set() });
    }
    const traversalId = data.id;
    const leftNode = ((data as Base["link"]).source ?? data) as Base["node"];
    const rightNode = ((data as Base["link"]).target ?? data) as Base["node"];

    return this.sankey.baseView.highlightCircular$.pipe(
      switchMap((highlightCircular) =>
        this.sankey.graph$.pipe(
          map(({ links }) => {
            links.forEach((l) => delete l.graphRelativePosition);
            return highlightCircular;
          })
        )
      ),
      map((highlightCircular) => {
        if (leftNode !== rightNode) {
          return {
            nodesIds: new Set(),
            linksIds: new Set(),
          };
        }
        const helper = {
          left: {
            graphRelativePosition: "left",
            nextNode: "source",
            nextLinks: "targetLinks",
            traversedLinks: new Set<Base["link"]>(),
          },
          right: {
            graphRelativePosition: "right",
            nextNode: "target",
            nextLinks: "sourceLinks",
            traversedLinks: new Set<Base["link"]>(),
          },
        };
        const nodes = new Set([leftNode, rightNode]);
        const objects2traverse = new Set([
          {
            direction: "left",
            node: leftNode,
            path: [],
          },
          {
            direction: "right",
            node: rightNode,
            path: [],
          },
        ]);

        for (const { direction, node, path } of objects2traverse) {
          const { graphRelativePosition, nextNode, nextLinks, traversedLinks } = helper[direction];
          node[nextLinks].forEach((l: Base["link"]) => {
            const had = traversedLinks.has(l);
            if (!had && (highlightCircular || !l.circular)) {
              traversedLinks.add(l);
              l.graphRelativePosition =
                l.visited === traversalId ? "multiple" : graphRelativePosition;
              l.visited = traversalId;
              nodes.add(l[nextNode]);
              objects2traverse.add({
                direction,
                node: l[nextNode],
                path: [...path, node, l],
              });
            }
          });
        }

        const links = new Set([...helper.left.traversedLinks, ...helper.right.traversedLinks]);

        links.forEach((l) => delete l.visited);
        delete (data as Base["link"]).graphRelativePosition;
        links.add(data as Base["link"]);

        return {
          nodesIds: mapIterable(nodes, ({ id }) => id),
          linksIds: mapIterable(links, ({ id }) => id),
        };
      })
    );
  });
  // region Select
  selectionUpdate$ = this.selection.selection$.pipe(
    // this base view operates on sigular selection
    publish((selection$: Observable<SelectionEntity>) =>
      zip(
        selection$.pipe(
          map(({ type, entity }) => type === SelectionType.node && entity),
          switchMap((entity) =>
            this.renderedNodes$.pipe(
              tap((renderedNodes) => {
                if (isEmpty(entity)) {
                  renderedNodes.attr("selected", undefined);
                } else {
                  renderedNodes
                    .attr("selected", ({ id }) => (entity as Base["node"]).id === id)
                    .filter(({ id }) => (entity as Base["node"]).id === id)
                    .raise();
                }
              })
            )
          ),
          debug("nodeSelection")
        ),
        selection$.pipe(
          map(({ type, entity }) => type === SelectionType.link && entity),
          switchMap((entity) =>
            this.renderedLinks$.pipe(
              tap((renderedLinks) => {
                if (isEmpty(entity)) {
                  renderedLinks.attr("selected", undefined);
                } else {
                  renderedLinks
                    .attr("selected", ({ id }) => (entity as Base["link"]).id === id)
                    .filter(({ id }) => (entity as Base["link"]).id === id)
                    .raise();
                }
              })
            )
          ),
          debug("linkSelection")
        ),
        selection$.pipe(
          map(({ entity }) => entity),
          this.$getConnectedNodesAndLinks,
          publish((connectedNodesAndLinks$) =>
            combineLatest([
              connectedNodesAndLinks$.pipe(
                map(({ nodesIds }) => nodesIds),
                switchMap((nodesIds) =>
                  this.renderedNodes$.pipe(
                    tap((renderedNodes) => {
                      if (isEmpty(nodesIds)) {
                        renderedNodes.attr("transitively-selected", undefined);
                      } else {
                        renderedNodes
                          .attr("transitively-selected", ({ id }) => nodesIds.has(id))
                          .filter(({ id }) => nodesIds.has(id))
                          .raise();
                      }
                    })
                  )
                ),
                debug("transnodeSelection")
              ),
              connectedNodesAndLinks$.pipe(
                map(({ linksIds }) => linksIds),
                switchMap((linksIds) =>
                  iif(
                    () => isEmpty(linksIds),
                    this.renderedLinks$.pipe(
                      map((renderedLinks) => renderedLinks.attr("transitively-selected", undefined))
                    ),
                    this.renderedLinks$.pipe(
                      switchMap((renderedLinks) =>
                        this.sankey.baseView.colorLinkByType$.pipe(
                          map((colorLinkByType) => {
                            if (colorLinkByType) {
                              // Odd requirement but transSelection should not yellow/blue color while colorLinkByType is on (so by default)
                              renderedLinks.attr(
                                "transitively-selected",
                                ({ graphRelativePosition }) => Boolean(graphRelativePosition)
                              );
                            } else {
                              renderedLinks.attr(
                                "transitively-selected",
                                ({ graphRelativePosition }) => graphRelativePosition ?? false
                              );
                            }
                            return renderedLinks
                              .filter(({ graphRelativePosition }) => Boolean(graphRelativePosition))
                              .raise();
                          })
                        )
                      )
                    )
                  )
                ),
                debug("translinkSelection")
              ),
            ])
          ),
          debug("transSelection")
        )
      )
    ),
    debug("selectionUpdate$")
  );

  constructor(
    readonly clipboard: ClipboardService,
    readonly snackBar: MatSnackBar,
    readonly sankey: SingleLaneLayoutService,
    readonly wrapper: ElementRef,
    protected zone: NgZone,
    protected selection: SankeySelectionService,
    protected search: SankeySearchService,
    readonly warningController: WarningControllerService,
    protected readonly updateController: EditService
  ) {
    super(clipboard, snackBar, sankey, wrapper, zone, selection, search, updateController);
    selection.multiselect = false;
  }

  ngOnInit() {
    super.ngOnInit();
  }

  initSelection() {
    this.selectionUpdate$.pipe(takeUntil(this.destroyed$)).subscribe();
  }

  initStateUpdate() {
    const { warningController } = this;
    this.sankey.baseView.colorLinkByType$
      .pipe(
        takeUntil(this.destroyed$),
        switchMap((colorLinkByType) =>
          this.renderedLinks$.pipe(
            tap((linksSelection) => {
              if (colorLinkByType) {
                linksSelection.attr("type", ({ label }) => label?.toLowerCase());
                // .each(function({label}) {
                //   const color = EdgeColorCodes[label.toLowerCase()];
                //   const stroke = color ? d3color(color).darker(0.5) : color;
                //   if (isDevMode()) {
                //     // This warning should not appear in prod "by design", yet it might be important for debugging
                //     warningController.assert(color, ErrorMessages.noColorMapping(label));
                //   }
                //   return d3_select(this)
                //     .style('stroke', stroke)
                //     .style('fill', color);
                // });
              } else {
                linksSelection.attr("type", undefined);
              }
            })
          )
        )
      )
      .subscribe();
  }

  initFocus() {
    forkJoin(this.focusedLink$, this.focusedNode$).pipe(takeUntil(this.destroyed$)).subscribe();
  }

  ngAfterViewInit() {
    super.ngAfterViewInit();
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }

  panToLink({ y0, y1, source: { x1 }, target: { x0 } }) {
    this.zoom.translateTo(
      // x
      (x1 + x0) / 2,
      // y
      (y0 + y1) / 2,
      undefined,
      true
    );
  }
}
