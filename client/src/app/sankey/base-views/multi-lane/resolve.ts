import { LayoutService } from './services/layout.service';
import { SankeyLayoutService } from '../../components/sankey/sankey-layout.service';
import { ControllerService } from './services/controller.service';
import { SankeyComponent } from '../../components/sankey/sankey.component';
import { SankeyMultiLaneAdvancedPanelComponent } from './components/advanced-panel/advanced-panel.component';
import { BaseControllerService } from '../../services/base-controller.service';

export default {
  providers: [
    {
      provide: SankeyLayoutService,
      useExisting: LayoutService
    },
    {
      provide: BaseControllerService,
      useClass: ControllerService
    }
  ],
  sankey: SankeyComponent,
  details: SankeyDetailsComponent,
  advanced: SankeyMultiLaneAdvancedPanelComponent
};
