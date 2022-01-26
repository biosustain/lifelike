import { AfterViewInit, Component, ComponentFactoryResolver, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { first } from 'rxjs/operators';

import { splitPascalCaseStr } from 'app/shared/utils';

import { PolicyHostDirective } from '../directives/policy-host.directive';
import { CookiePolicyComponent } from './cookie-policy.component';
import { PrivacyPolicyComponent } from './privacy-policy.component';

// Can maybe move these into their own files if they become more complex.
class PolicyComponent {
  constructor() {}
}

interface PolicyItem {
  name: string;
  component: any;
}

@Component({
  selector: 'app-policies',
  templateUrl: './policy-viewer.component.html',
  styleUrls: ['./policy-viewer.component.scss']
})
export class PolicyViewerComponent implements OnInit, AfterViewInit {
  // Consider moving this to a constants file eventually, probably fine to leave it as-is for now.
  legalDocComponents = [
    CookiePolicyComponent,
    PrivacyPolicyComponent
  ];

  policyMap: Map<string, PolicyItem>;
  defaultPolicy: PolicyItem;
  currentPolicy: PolicyItem;

  @ViewChild(PolicyHostDirective, {static: true}) appPolicyHost!: PolicyHostDirective;

  constructor(
    private componentFactoryResolver: ComponentFactoryResolver,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.policyMap = new Map<string, PolicyItem>();

    this.legalDocComponents.forEach((component, index) => {
      const splitComponentName = splitPascalCaseStr(component.name).split(' ');
      const docName = splitComponentName.slice(0, splitComponentName.length - 1).join(' ');
      const policyItem = { name: docName, component } as PolicyItem;
      const docId = docName.replace(/ /g, '-').toLowerCase();

      // Set the default policy to the first component in the list, and set the current policy to the default.
      if (index === 0) {
        this.defaultPolicy = policyItem;
        this.currentPolicy = this.defaultPolicy;
      }
      this.policyMap.set(docId, policyItem);
    });
  }

  ngOnInit(): void {
    this.route.params.pipe(first()).subscribe(params => {
      this.currentPolicy = this.policyMap.get(params.policy) || this.defaultPolicy;
    });
  }

  ngAfterViewInit() {
    this.loadPolicy(this.currentPolicy);
  }

  /**
   * Dynamically loads the component identified by the provided PolicyItem object into the view container.
   * @param policyItem PolicyItem object containing details about a policy component
   */
  loadPolicy(policyItem: PolicyItem) {
    const viewContainerRef = this.appPolicyHost.viewContainerRef;
    viewContainerRef.clear();

    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(policyItem.component);

    const componentRef = viewContainerRef.createComponent(componentFactory);
    (componentRef.instance as PolicyComponent) = policyItem;
  }

  /**
   * Updates the URL route to use the given policy. E.g. "/policies/cookie-policy" or "/policies/privacy-policy".
   * @param policy a string representing the segment to be used in the URL
   */
  navigateToPolicy(policy: string) {
    this.router.navigateByUrl(`/policies/${policy}`);
  }

  /**
   * Callback for the policy dropdown list. Updates the shown policy and the URL.
   * @param policy string identifier for the policy to be shown
   */
  policyClicked(policy: string) {
    this.currentPolicy = this.policyMap.get(policy);
    this.navigateToPolicy(policy);
    this.loadPolicy(this.currentPolicy);
  }
}
