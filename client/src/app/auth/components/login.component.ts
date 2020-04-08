import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';

import { Store } from '@ngrx/store';
import { State } from 'app/root-store';

import * as AuthActions from '../store/actions';


@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {

  form = new FormGroup({
    email: new FormControl(),
    password: new FormControl()
  });

  formSubscription: Subscription;

  constructor(private store: Store<State>) { }

  ngOnInit() {
    this.formSubscription = this.form.valueChanges.subscribe(val => {
      this.form.controls.email.setErrors(null);
    });
  }

  ngOnDestroy() {
    this.formSubscription.unsubscribe();
  }

  /**
   * Call login API for jwt credential
   */
  submit() {
    const { email, password } = this.form.value;
    this.store.dispatch(AuthActions.login({credential: {email, password}}));
  }
}
