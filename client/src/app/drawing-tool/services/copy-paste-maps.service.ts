import { Injectable } from '@angular/core';

import { VisNetworkGraphNode, VisNetworkGraphEdge } from './interfaces';

@Injectable()
export class CopyPasteMapsService {
    copiedNodes: VisNetworkGraphNode[] = [];
    copiedEdges: VisNetworkGraphEdge[] = [];

    constructor() { }
}
