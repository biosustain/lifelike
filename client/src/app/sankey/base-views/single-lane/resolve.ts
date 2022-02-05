import { LayoutService } from 'app/sankey/services/customised-sankey-layout.service';

import { SankeySingleLaneAdvancedPanelComponent } from './components/advanced-panel/advanced-panel.component';
import { SankeySingleLaneDetailsPanelComponent } from './components/details-panel/details-panel.component';
import { SankeyLayoutService } from '../../components/sankey/sankey-layout.service';
import { SankeySingleLaneComponent } from './components/sankey/sankey.component';
import { BaseViewControllerService } from '../../services/sankey-base-view-controller.service';
import { LayoutService } from './services/layout.service';
import { ControllerService } from './services/controller.service';

export default {
  providers: [
    {
      provide: LayoutService,
      useClass: LayoutService
    },
    {
      provide: LayoutService,
      useClass: LayoutService
    },
    {
      provide: SankeyLayoutService,
      useExisting: LayoutService
    },
    {
      provide: BaseViewControllerService,
      useClass: ControllerService
    }
  ],
  sankey: SankeySingleLaneComponent,
  details: SankeySingleLaneDetailsPanelComponent,
  advanced: SankeySingleLaneAdvancedPanelComponent
};
