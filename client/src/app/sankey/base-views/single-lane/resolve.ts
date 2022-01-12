import { CustomisedSankeySingleLaneLayoutService } from './services/customised-sankey-layout.service';
import { SankeySingleLaneAdvancedPanelComponent } from './components/advanced-panel/advanced-panel.component';
import { SankeySingleLaneDetailsPanelComponent } from './components/details-panel/details-panel.component';
import { SankeyLayoutService } from '../../components/sankey/sankey-layout.service';
import { SankeyControllerService  } from '../../services/sankey-controller.service';
import { SankeySingleLaneControllerService } from './services/sankey-controller.service';
import { SankeySingleLaneComponent } from './components/sankey/sankey.component';
import { SankeyBaseViewControllerService } from '../../services/sankey-base-view-controller.service';

export default {
  providers: [
    {
      provide: CustomisedSankeySingleLaneLayoutService,
      useClass: CustomisedSankeySingleLaneLayoutService
    },
    {
      provide: SankeyLayoutService,
      useExisting: CustomisedSankeySingleLaneLayoutService
    },
    {
      provide: SankeyBaseViewControllerService,
      useClass: SankeySingleLaneControllerService
    }
  ],
  sankey: SankeySingleLaneComponent,
  details: SankeySingleLaneDetailsPanelComponent,
  advanced: SankeySingleLaneAdvancedPanelComponent
};
