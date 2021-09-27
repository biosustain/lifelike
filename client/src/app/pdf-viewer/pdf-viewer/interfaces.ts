import { RenderTextMode } from '../utils/constants';

export interface PDFProgressData {
  loaded: number;
  total: number;
}

export type PDFSource =
  string |
  Uint8Array |
  { data: Uint8Array } |
  { url: string };

export interface PDFViewerParams {
  eventBus: any;
  container: Node;
  removePageBorders: boolean;
  linkService: any;
  textLayerMode: RenderTextMode;
  findController: any;
}
