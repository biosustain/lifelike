import { Component, Input, OnChanges } from '@angular/core';
import { Hyperlink } from '../../drawing-tool/services/interfaces';

@Component({
  selector: 'app-quick-search',
  templateUrl: './quick-search.component.html',
})
export class QuickSearchComponent implements OnChanges {
  @Input() query: string | undefined;
  @Input() links: Hyperlink[] | undefined;
  @Input() linkTemplates: Hyperlink[] = [{
    domain: 'NCBI',
    url: 'https://www.ncbi.nlm.nih.gov/gene/?query=%s',
  }, {
    domain: 'UniProt',
    url: 'https://www.uniprot.org/uniprot/?sort=score&query=%s',
  }, {
    domain: 'Wikipedia',
    url: 'https://www.google.com/search?q=site:+wikipedia.org+%s',
  }, {
    domain: 'Google',
    url: 'https://www.google.com/search?q=%s',
  }];

  generated = false;
  shownLinks: Hyperlink[] = [];

  ngOnChanges() {
    if (this.links != null && this.links.length) {
      this.shownLinks = this.links.concat().sort((a, b) => a.domain.localeCompare(b.domain));
      this.generated = false;
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
