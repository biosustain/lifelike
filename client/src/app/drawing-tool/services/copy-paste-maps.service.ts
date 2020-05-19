import { Injectable } from '@angular/core';

import { UniversalGraphEdge, UniversalGraphNode } from './interfaces';

@Injectable()
export class CopyPasteMapsService {
  copiedNodes: UniversalGraphNode[] = [];
  copiedEdges: UniversalGraphEdge[] = [];

  constructor() {
  }
}
