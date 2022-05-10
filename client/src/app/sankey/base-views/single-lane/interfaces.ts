import { TypeContext } from 'app/sankey/interfaces';

import { SankeyBaseState, SankeyBaseOptions } from '../interfaces';
import { SelectionEntity, SelectionType } from '../../interfaces/selection';
import { SankeyNode, SankeyLink } from '../../model/sankey-document';

export interface SankeySingleLaneStateExtend {
  highlightCircular: boolean;
  colorLinkByType: boolean;
}

export type SankeySingleLaneState = SankeyBaseState & SankeySingleLaneStateExtend;

export interface SankeySingleLaneOptionsExtend {
  colorLinkTypes: { [type: string]: string };
}

export type SankeySingleLaneOptions = SankeyBaseOptions & SankeySingleLaneOptionsExtend;


export type SelectionSingleLaneEntity = SelectionEntity | {
  [SelectionType.link]: Base['link'];
};

export type SankeySingleLaneSelection = {
  node: Base['node']
} | {
  link: Base['link']
} | {
  trace: Base['trace']
};

export type BaseOptions = SankeySingleLaneOptions;
export type BaseState = SankeySingleLaneState;

export interface Base extends TypeContext {
  options: BaseOptions;
  state: BaseState;
  link: SankeyLink;
  node: SankeyNode<this['link']>;
}

export interface Palette {
  name: string;
  palette: (size: number, params: object) => (i: number) => string | object;
  help?: string;
}
