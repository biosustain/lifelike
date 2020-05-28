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
  GRAPH_DATA: GraphData;

  @Input()
  set graphData(val: GraphData) {
    if (
      isNullOrUndefined(val.data.search)
    ) {
      val.data.search = this.generateSearchLinks(
        val.label
      );
    }

    this.GRAPH_DATA = val;
  }

  get graphData() {
    return this.GRAPH_DATA;
  }

  searchLinks = [
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
    return this.searchLinks.map(
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
