import { Component, OnInit, Input } from '@angular/core';
import { GraphData, Hyperlink } from 'app/drawing-tool/services/interfaces';
import { SearchLink } from 'app/shared/constants';
import { isNullOrUndefined } from 'util';

@Component({
  selector: 'app-search-links',
  templateUrl: './search-links.component.html',
  styleUrls: ['./search-links.component.scss']
})
export class SearchLinksComponent implements OnInit {
  searchLinks: Hyperlink[] = [];

  @Input()
  set graphData(val: GraphData) {
    // Check if search links are empty or undefined
    const isEmpty = isNullOrUndefined(val.data.search) ?
      true :
      val.data.search.length ? false : true;

    if (
      isEmpty
    ) {
      this.searchLinks = this.generateSearchLinks(
        val.label
      );
    } else {
      this.searchLinks = val.data.search;
    }
  }

  searchLinkTemplates = [
    {
      queryUrl: SearchLink.Google,
      domain: 'Google'
    },
    {
      queryUrl: SearchLink.Ncbi,
      domain: 'NCBI'
    },
    {
      queryUrl: SearchLink.Uniprot,
      domain: 'UniProt'
    },
    {
      queryUrl: SearchLink.Wikipedia,
      domain: 'Wikipedia'
    }
  ];

  constructor() { }

  ngOnInit() {

  }

  generateSearchLinks(entity): Hyperlink[] {
    return this.searchLinkTemplates.map(
      s => {
        const url = s.queryUrl + entity;
        const domain = s.domain;
        return {
          url,
          domain
        };
      }
    );
  }

  /**
   * Allow user to navigate to a link in a new tab
   */
  goToLink(url= null) {
    const hyperlink: string = url;

    if (!hyperlink) { return; }

    if (
      hyperlink.includes('http')
    ) {
      window.open(hyperlink, '_blank');
    } else if (
      hyperlink.includes('mailto')
    ) {
      window.open(hyperlink);
    } else {
      window.open('http://' + hyperlink);
    }
  }
}
