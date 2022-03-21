import { InjectionToken } from '@angular/core';

import { DefaultSankeyAbstractComponent } from '../abstract/sankey.component';
import { SankeyAbstractDetailsPanelComponent } from '../abstract/details-panel.component';
import { DefaultAbstractAdvancedPanelComponent } from '../abstract/advanced-panel.component';

export const SANKEY_GRAPH = new InjectionToken<DefaultSankeyAbstractComponent>('SankeyGraph');
export const SANKEY_DETAILS = new InjectionToken<SankeyAbstractDetailsPanelComponent>('SankeyDetails');
export const SANKEY_ADVANCED = new InjectionToken<DefaultAbstractAdvancedPanelComponent>('SankeyAdvanced');
