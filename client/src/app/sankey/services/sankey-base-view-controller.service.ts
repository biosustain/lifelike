import { Injectable } from '@angular/core';

import { ReplaySubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { merge } from 'lodash-es';

import { SankeyOptions, SankeyState, ViewBase } from 'app/sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

import { SankeyControllerService } from './sankey-controller.service';


/**
 * Service meant to hold overall state of Sankey view (for ease of use in nested components)
 * It is responsible for holding Sankey data and view options (including selected networks trace)
 * This class is not meant to be aware of singular Sankey visualisation state like,
 *  selected|hovered nodes|links|traces, zooming, panning etc.
 */
@Injectable()
export class SankeyBaseViewControllerService<Options extends object = object, State extends object = object>
  extends SankeyControllerService {
  constructor(
    readonly controller: SankeyControllerService,
    readonly warningController: WarningControllerService
  ) {
    super(warningController);
    this.defaultState$ = super.defaultState$.pipe(
      map(state => merge(state, this.baseDefaultState)
      )
    );

    this.defaultOptions$ = super.defaultOptions$.pipe(
      map(options => merge(options, this.baseDefaultOptions))
    );
  }

  readonly baseDefaultState: Partial<State & SankeyState>;
  readonly baseDefaultOptions: Partial<Options & SankeyOptions>;

  readonly viewBase: ViewBase;

  // @ts-ignore
  options$: ReplaySubject<SankeyOptions & Options>;
  // @ts-ignore
  state$: ReplaySubject<SankeyState & State>;

  /**
   * Color nodes in gray scale based on group they are relating to.
   */
  colorNodes(nodes, nodeColorCategoryAccessor = ({schemaClass}) => schemaClass) {
    throw new Error('Method not implemented.');
  }
}
