import { CustomisedSankeyMultiLaneLayoutService } from './services/customised-sankey-multi-lane-layout.service';
import { SankeyLayoutService } from '../../components/sankey/sankey-layout.service';
import { SankeyMultiLaneControllerService } from './services/sankey-multi-lane-controller.service';
import { SankeyComponent } from '../../components/sankey/sankey.component';
import { SankeyDetailsComponent } from '../../components/details-panel/details.component';
import { SankeyMultiLaneAdvancedPanelComponent } from './components/advanced-panel/advanced-panel.component';
import { CustomisedSankeyLayoutService } from '../../services/customised-sankey-layout.service';
import { SankeyBaseViewControllerService } from '../../services/sankey-base-view-controller.service';

export default {
  providers: [
    {
      provide: CustomisedSankeyLayoutService,
      useClass: CustomisedSankeyMultiLaneLayoutService
    },
    {
      provide: SankeyLayoutService,
      useExisting: CustomisedSankeyMultiLaneLayoutService
    },
    {
      provide: SankeyBaseViewControllerService,
      useClass: SankeyMultiLaneControllerService
    }
  ],
  sankey: SankeyComponent,
  details: SankeyDetailsComponent,
  advanced: SankeyMultiLaneAdvancedPanelComponent
};
