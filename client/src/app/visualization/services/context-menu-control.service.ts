import { Injectable } from '@angular/core';

import { TooltipControlService } from './tooltip-control-service';

@Injectable()
export class ContextMenuControlService extends TooltipControlService {
    constructor() {
        super();
    }
}
