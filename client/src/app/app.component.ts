import { Component } from '@angular/core';
import { MatIconRegistry } from '@angular/material';
import { DomSanitizer } from '@angular/platform-browser';
import { AppLink, MenuLink } from 'toolbar-menu';

@Component({
  selector: 'app-***ARANGO_USERNAME***',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  title = 'client';

  homeLink = '/home';
  icons = ['table-edit', 'beaker-outline', 'outline-menu'];
  sidenavLinks: AppLink[] = [
    {
      tooltip: 'First Widget',
      routerLink: '/first-widget',
      svgIcon: 'beaker-outline'
    },
    {
      tooltip: 'Benchling',
      externalLink: 'https://dtubiosustaintest.benchling.com',
      materialIcon: 'help'
    }
  ];
  userMenuLinks: MenuLink[] = [
    {
      materialIcon: 'person',
      displayText: 'Name'
    },
    {
      materialIcon: 'lock',
      displayText: 'Log Out',
      routerLink: '/home'
    }
  ];

  constructor(iconRegistry: MatIconRegistry, sanitizer: DomSanitizer) {

    for (const icon of this.icons) {
      iconRegistry.addSvgIcon(icon, sanitizer.bypassSecurityTrustResourceUrl(`assets/icons/${icon}.svg`));
    }
  }
}
