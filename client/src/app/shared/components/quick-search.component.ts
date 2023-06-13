import { Component, Input, OnChanges } from '@angular/core';

import { forEach } from 'lodash-es';

import { Hyperlink } from 'app/drawing-tool/services/interfaces';

import { LINKS } from '../links';

@Component({
  selector: 'app-quick-search',
  templateUrl: './quick-search.component.html',
})
export class QuickSearchComponent implements OnChanges {
  @Input() query: string | undefined;
  @Input() links: Hyperlink[] | undefined;
  @Input() normalizeDomains = true;

  generated = false;
  shownLinks: Hyperlink[] = [];

  ngOnChanges() {
    if (this.links != null && this.links.length) {
      // links should be sorted in the order that they appear in SEARCH_LINKS
      const sortOrder = Object.keys(LINKS);
      this.shownLinks = this.links.sort(
        (linkA, linkB) => sortOrder.indexOf(linkA.domain) - sortOrder.indexOf(linkB.domain)
      );
      this.generated = false;
      if (this.normalizeDomains) {
        const normalizedMapping = new Map<string, string>();
        forEach(LINKS, (linkEntity, domain) => {
          normalizedMapping.set(domain, linkEntity.label);
        });
        for (const link of this.shownLinks) {
          const normalized = normalizedMapping.get(link.domain);
          if (normalized != null) {
            link.domain = normalized;
          }
        }
      }
    } else if (this.query != null) {
      this.shownLinks = Object.values(LINKS).map((linkEntity) => ({
        domain: linkEntity.label,
        url: linkEntity.search(this.query),
      }));
      this.generated = true;
    } else {
      this.shownLinks = [];
      this.generated = true;
    }
  }
}
