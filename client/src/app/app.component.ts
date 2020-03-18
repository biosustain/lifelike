import { Component, OnInit } from '@angular/core';
import { MatIconRegistry } from '@angular/material';
import { DomSanitizer } from '@angular/platform-browser';
import { AppLink, MenuLink } from 'toolbar-menu';
import { AdminService } from 'app/admin/services/admin.service';
import { AppUser } from 'app/interfaces';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

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

  constructor(
      iconRegistry: MatIconRegistry,
      sanitizer: DomSanitizer,
      private adminService: AdminService,
    ) {

    for (const icon of this.icons) {
      iconRegistry.addSvgIcon(icon, sanitizer.bypassSecurityTrustResourceUrl(`assets/icons/${icon}.svg`));
    }
  }

  ngOnInit() {
    // TODO: This needs to be implemented via RxJS to keep the state OR an observable
    // this.adminService.currentUser().subscribe((user: AppUser) => {
    //   if (user.roles.includes('admin')) {
    //     this.userMenuLinks.push({
    //       materialIcon: 'person',
    //       displayText: 'Admin',
    //       routerLink: '/admin',
    //     });
    //   }
    // });
  }
}
