import { Injectable } from '@angular/core';

import { TooltipControlService } from 'app/shared/services/tooltip-control-service';

@Injectable({
  providedIn: '***ARANGO_USERNAME***'
})
export class DrawingToolContextMenuControlService extends TooltipControlService {
    constructor() {
        super();
    }
}
