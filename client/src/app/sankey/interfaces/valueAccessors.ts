// region UI options
import { IntermediateProcessedData, NetworkTraceData, TypeContext } from './index';
import { DefaultLayoutService } from '../services/layout.service';
import { Property } from './property';

export interface ValueAccessor extends Property {
  help?: string;
  type?: LINK_PROPERTY_GENERATORS;
}

export type ValueProcessingStep<Base extends TypeContext> =
  (this: DefaultLayoutService, v: NetworkTraceData<Base>) =>
    (Partial<NetworkTraceData<Base>> & IntermediateProcessedData) | undefined;

export interface ValueGenerator<Base extends TypeContext> {
  preprocessing: ValueProcessingStep<Base>;
  postprocessing?: ValueProcessingStep<Base>;
  // not used yet
  requires?: any;
}

export interface MultiValueAccessor extends ValueAccessor {
  linkValueAccessorId: string;
  nodeValueAccessorId: string;
  type: LINK_PROPERTY_GENERATORS;
}

export interface NodeValueAccessor {
  [nodeValuePropertyName: string]: ValueAccessor;
}

export interface LinkValueAccessor {
  [linkValuePropertyName: string]: ValueAccessor;
}

export type PREDEFINED_VALUE_ACCESSORS = {
  [linkValueGeneratorId in PREDEFINED_VALUE | string]?: MultiValueAccessor
};

export enum LINK_VALUE_GENERATOR {
  fixedValue0 = 'Fixed Value = 0',
  fixedValue1 = 'Fixed Value = 1',
  input_count = 'Input count',
  // fraction_of_fixed_nodevalue = 'Fraction of fixed node value',
}

export enum LINK_PROPERTY_GENERATORS {
  byArrayProperty = 'By Array Property',
  byProperty = 'By Property',
}

export type LINK_VALUE_GENERATORS = {
  [linkValueGeneratorId in LINK_VALUE_GENERATOR]?: ValueAccessor
};
export type NODE_VALUE_GENERATORS = {
  [linkValueGeneratorId in NODE_VALUE_GENERATOR]: ValueAccessor
};

export enum NODE_VALUE_GENERATOR {
  none = 'None',
  fixedValue1 = 'Fixed Value = 1'
}

export enum PREDEFINED_VALUE {
  fixed_height = 'Fixed height',
  input_count = 'Input count'
}
