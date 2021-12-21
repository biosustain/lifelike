import { CustomisedSankeyLayoutService } from './services/customised-sankey-layout.service';
import { SankeyLayoutService } from './components/sankey/sankey-layout.service';
import { SankeyControllerService } from './services/sankey-controller.service';
import { SankeyComponent } from './components/sankey/sankey.component';
import { SankeyDetailsComponent } from './components/details-panel/details.component';
import { SankeyAdvancedPanelComponent } from './components/advanced-panel/advanced-panel.component';

export default {
  providers: [
    {
      provide: CustomisedSankeyLayoutService,
      useClass: CustomisedSankeyLayoutService
    },
    {
      provide: SankeyLayoutService,
      useExisting: CustomisedSankeyLayoutService
    },
    {
      provide: SankeyControllerService,
      useClass: SankeyControllerService
    }
  ],
  sankey: SankeyComponent,
  details: SankeyDetailsComponent,
  advanced: SankeyAdvancedPanelComponent
};
