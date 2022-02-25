import { InjectionToken } from '@angular/core';

import { SankeyAbstractComponent, DefaultSankeyAbstractComponent } from './abstract/sankey.component';
import { SankeyDetailsPanelComponent } from './components/details-panel/details-panel.component';
import { SankeyAbstractAdvancedPanelComponent, DefaultAbstractAdvancedPanelComponent } from './abstract/advanced-panel.component';

export const SANKEY_GRAPH = new InjectionToken<DefaultSankeyAbstractComponent>('SankeyGraph');
export const SANKEY_DETAILS = new InjectionToken<SankeyDetailsPanelComponent>('SankeyDetails');
export const SANKEY_ADVANCED = new InjectionToken<DefaultAbstractAdvancedPanelComponent>('SankeyAdvanced');
