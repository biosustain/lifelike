import { ViewBase } from './interfaces';

export const viewBaseToNameMapping = {
  [ViewBase.sankeyMultiLane]: 'Multi-Lane View',
  [ViewBase.sankeySingleLane]: 'Single-Lane View'
};

export function extractDescriptionFromSankey(text: string): string {
  try {
    const content = JSON.parse(text);
    return content.graph.description || '';
  } catch (e) {
    return '';
  }
}
