import { Component, Input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { SankeyEntityDetailsComponent } from 'app/sankey/abstract/entity-details/entity-details.component';

import { SankeyMultiLaneLink } from '../../interfaces';
import { ControllerService } from '../../../../services/controller.service';
import { MultiLaneBaseControllerService } from '../../services/multi-lane-base-controller.service';
import { SankeyAbstractLinkDetailsComponent } from '../../../../abstract/entity-details/link-details.component';

@Component({
  selector: 'app-sankey-multi-lane-link-details',
  templateUrl: './link-details.component.html'
})
export class SankeyMultiLaneLinkDetailsComponent extends SankeyAbstractLinkDetailsComponent {
}

