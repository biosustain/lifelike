import { CustomisedSankeyManyToManyLayoutService } from './services/customised-sankey-layout.service';
import { SankeyManyToManyAdvancedPanelComponent } from './components/advanced-panel/advanced-panel.component';
import { SankeyManyToManyDetailsPanelComponent } from './components/details-panel/details-panel.component';
import { SankeyLayoutService } from '../sankey-viewer/components/sankey/sankey-layout.service';
import { SankeyControllerService  } from '../sankey-viewer/services/sankey-controller.service';
import { SankeyManyToManyControllerService } from './services/sankey-controller.service';
import { SankeyManyToManyComponent } from './components/sankey/sankey.component';

export default {
  providers: [
    {
      provide: CustomisedSankeyManyToManyLayoutService,
      useClass: CustomisedSankeyManyToManyLayoutService
    },
    {
      provide: SankeyLayoutService,
      useExisting: CustomisedSankeyManyToManyLayoutService
    },
    {
      provide: SankeyControllerService,
      useClass: SankeyManyToManyControllerService
    }
  ],
  sankey: SankeyManyToManyComponent,
  details: SankeyManyToManyDetailsPanelComponent,
  advanced: SankeyManyToManyAdvancedPanelComponent
};
