export interface SankeyNodeHeight {
  min: {
    enabled: boolean,
    value: number
  };
  max: {
    enabled: boolean,
    ratio: number
  };
}

// tslint:disable-next-line:no-empty-interface
export interface SankeyBaseOptions {
}

export interface SankeyBaseState {
  shortestPathPlusN: number;
  nodeHeight: SankeyNodeHeight;
  nodeValueAccessorId?: string;
  linkValueAccessorId?: string;
  predefinedValueAccessorId?: string;
}
