import { InjectionToken } from '@angular/core';

import { SankeyComponent } from './components/sankey/sankey.component';
import { SankeyDetailsPanelComponent } from './components/details-panel/details-panel.component';
import { SankeyAbstractAdvancedPanelComponent } from './abstract/advanced-panel.component';

export const SANKEY_GRAPH = new InjectionToken<SankeyComponent>('SankeyGraph');
export const SANKEY_DETAILS = new InjectionToken<SankeyDetailsPanelComponent>('SankeyDetails');
export const SANKEY_ADVANCED = new InjectionToken<SankeyAbstractAdvancedPanelComponent>('SankeyAdvanced');
