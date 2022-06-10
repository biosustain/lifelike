/**
 * Separated from interfaces.ts so it can be imported in webworker enviroment
 */
import { Color } from 'd3-color';

import { GraphNode, GraphLink, GraphTrace } from 'app/shared/providers/graph-type/interfaces';

// region Graph as Sankey
export type SankeyId = string | number;

// Preping for render
export interface SankeyNodeInterface {
  id: number;
  label?: string;
  description?: string;
  color: string | Color;
  // value?: number;
  depth: number;
  reversedDepth: number;
  order: number;
  // viewProperties?: object;
  height: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  sourceLinks: SankeyLinkInterface[];
  targetLinks: SankeyLinkInterface[];
  value: number;
  layer: number;
}

// preping for render
export interface SankeyLinkInterface {
  id: SankeyId;
  description: string;
  multipleValues?: [number, number];
  value: number;
  adjacentDivider: number;
  color: string | Color;
  // description: string;
  circular: boolean;
  // viewProperties?: object;
  source: SankeyNodeInterface;
  target: SankeyNodeInterface;
  width: number;
}

export interface SankeyNodePosition {
  y0: number;
  y1: number;
  x0: number;
  x1: number;
  layer: number;
  height: number;
  reversedDepth: number;
}

