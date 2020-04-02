import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  Router
} from '@angular/router';
import {
  FormGroup, FormControl, Validators
} from '@angular/forms';
import {
  Subscription
} from 'rxjs';

import {
  AuthenticationService
} from '../services/authentication.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {

  form = new FormGroup({
    "email_addr": new FormControl(),
    "password": new FormControl()
  });

  formSubscription: Subscription;

  constructor(
    private authService: AuthenticationService,
    private route: Router
  ) { }

  ngOnInit() {
    this.formSubscription = this.form.valueChanges.subscribe(val => {
      this.form.controls['email_addr'].setErrors(null);
    });
  }

  ngOnDestroy() {
    this.formSubscription.unsubscribe();
  }

  /**
   * Call login API for jwt credential
   */
  submit() {
    let credential_form = this.form.value;

    this.authService.login(credential_form)
      .subscribe(
        resp => {
          this.route.navigateByUrl('dt/project-list');
        },
        error => {
          this.form.controls['email_addr'].setErrors({required: true});
        });
  }
}
