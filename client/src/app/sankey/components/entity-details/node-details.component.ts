import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { SankeyEntityDetailsComponent } from '../../abstract/entity-details/entity-details.component';
import { BaseControllerService } from '../../services/base-controller.service';
import { TypeContext } from '../../interfaces';

@Component({
  selector: 'app-sankey-node-details',
  templateUrl: './node-details.component.html',
})
export class SankeyNodeDetailsComponent extends SankeyEntityDetailsComponent {
  constructor(
    protected baseView: BaseControllerService<TypeContext>,
    protected readonly route: ActivatedRoute
  ) {
    super(baseView.common, route);
  }

  readonly nodeValueAccessors$ = this.common.nodeValueAccessors$;
  readonly nodeValueAccessor$ = this.baseView.nodeValueAccessor$;

  fixCircumstantialBiocycLink(link) {
    // Manual parsing seems like only choice
    if (link) {
      const partedUrl = link.split('?');
      if (partedUrl.length === 2) {
        const [url, search] = partedUrl;
        const params = search.split('&').map((e) => {
          const [k, v] = e.split('=');
          return `${k}=${encodeURIComponent(v)}`;
        });
        return `${url}?${params.join('&')}`;
      }
    }
  }

  biocycLink(biocycId) {
    return 'https://biocyc.org/ECOLI/NEW-IMAGE?object=' + encodeURIComponent(biocycId);
  }

  reactomeLink(stId) {
    return 'https://reactome.org/content/detail/' + encodeURIComponent(stId);
  }
}
