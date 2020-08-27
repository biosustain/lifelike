import { Component, Input, OnChanges } from '@angular/core';
import { Hyperlink } from '../../drawing-tool/services/interfaces';
import { SEARCH_LINKS } from '../links';
import { cloneDeep } from 'lodash';

@Component({
  selector: 'app-quick-search',
  templateUrl: './quick-search.component.html',
})
export class QuickSearchComponent implements OnChanges {
  @Input() query: string | undefined;
  @Input() links: Hyperlink[] | undefined;
  @Input() linkTemplates: Hyperlink[] = cloneDeep(SEARCH_LINKS);
  @Input() normalizeDomains = true;

  generated = false;
  shownLinks: Hyperlink[] = [];

  ngOnChanges() {
    if (this.links != null && this.links.length) {
      this.shownLinks = this.links.concat().sort((a, b) => a.domain.localeCompare(b.domain));
      this.generated = false;
      if (this.normalizeDomains) {
        const normalizedMapping = new Map<string, string>();
        for (const link of this.linkTemplates) {
          normalizedMapping.set(link.domain.toLowerCase(), link.domain);
        }
        for (const link of this.shownLinks) {
          const normalized = normalizedMapping.get(link.domain);
          if (normalized != null) {
            link.domain = normalized;
          }
        }
      }
    } else if (this.query != null) {
      this.shownLinks = this.linkTemplates.map(link => ({
        domain: link.domain,
        url: link.url.replace('%s', encodeURIComponent(this.query)),
      })).concat().sort((a, b) => a.domain.localeCompare(b.domain));
      this.generated = true;
    } else {
      this.shownLinks = [];
      this.generated = true;
    }
  }
}
