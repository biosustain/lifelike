import { Injectable } from '@angular/core';

import { TooltipControlService } from 'app/shared/services/tooltip-control-service';

@Injectable()
export class ReferenceTableControlService extends TooltipControlService {
    constructor() {
        super();
    }
}
