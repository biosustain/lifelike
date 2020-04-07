import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  Router
} from '@angular/router';
import {
  FormGroup, FormControl
} from '@angular/forms';
import {
  Subscription
} from 'rxjs';

import {
  AuthenticationService
} from '../services';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {

  form = new FormGroup({
    emailAddr: new FormControl(),
    password: new FormControl()
  });

  formSubscription: Subscription;

  constructor(
    private authService: AuthenticationService,
    private route: Router
  ) { }

  ngOnInit() {
    this.formSubscription = this.form.valueChanges.subscribe(val => {
      this.form.controls.emailAddr.setErrors(null);
    });
  }

  ngOnDestroy() {
    this.formSubscription.unsubscribe();
  }

  /**
   * Call login API for jwt credential
   */
  submit() {
    const credentialForm = this.form.value;

    this.authService.login(credentialForm)
      .subscribe(
        resp => {
          this.route.navigateByUrl('dt/project-list');
        },
        error => {
          this.form.controls.emailAddr.setErrors({required: true});
        });
  }
}
