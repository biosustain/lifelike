import { Injectable } from '@angular/core';

import { TooltipControlService } from 'app/shared/services/tooltip-control-service';

@Injectable()
export class ContextMenuControlService extends TooltipControlService {
    constructor() {
        super();
    }
}
