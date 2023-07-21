import { Component, OnInit } from '@angular/core';

import { ChatGPT } from './ChatGPT';

@Component({
  selector: 'app-cost-estimate-tooltip',
  template: `The pricing information has been last updated on {{ lastPricingUpdate | date : 'medium' }}`
})
export class CostEstimateTooltipComponent {
  lastPricingUpdate = ChatGPT.lastUpdate;
}
