import { Injectable } from '@angular/core';

import { TooltipControlService } from 'app/shared/services/tooltip-control-service';

@Injectable({
  providedIn: 'root'
})
export class DrawingToolContextMenuControlService extends TooltipControlService {
    constructor() {
        super();
    }
}
