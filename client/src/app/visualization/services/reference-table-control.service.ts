import { Injectable } from '@angular/core';

import { TooltipControlService } from '../../shared/services/tooltip-control-service';

@Injectable()
export class ReferenceTableControlService extends TooltipControlService {
    constructor() {
        super();
    }
}
