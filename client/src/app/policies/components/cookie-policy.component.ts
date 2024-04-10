import { AfterViewInit, Component, ViewChild } from '@angular/core';

@Component({
  selector: 'app-cookie-policy',
  templateUrl: './cookie-policy.component.html',
})
export class CookiePolicyComponent implements AfterViewInit {
  @ViewChild('cookiePolicyContainer', { static: true }) cookiePolicyContainer;
  constructor() {}

  ngAfterViewInit(): void {
    // Angular automatically strips script elements from component templates, so we have to add the cookiebot script manually.
    const s = document.createElement('script');
    s.id = 'CookieDeclaration';
    s.type = 'text/javascript';
    s.src = 'https://consent.cookiebot.com/2c4d1aa6-66d7-4d10-a8dc-4ddc145b829a/cd.js';
    this.cookiePolicyContainer.nativeElement.appendChild(s);
  }
}
