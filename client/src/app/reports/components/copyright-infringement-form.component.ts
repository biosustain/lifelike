import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-copyright-infringement-form',
  templateUrl: './copyright-infringement-form.component.html',
})
export class CopyrightInfringementFormComponent implements OnInit {
  DESCRIPTION_MAX_LEN = 1000;

  form: FormGroup;

  constructor() { }

  ngOnInit(): void {
    this.form = new FormGroup({
      url: new FormControl('', Validators.required),
      description: new FormControl('', [Validators.required, Validators.maxLength(this.DESCRIPTION_MAX_LEN)]),
      name: new FormControl('', Validators.required),
      company: new FormControl('', Validators.required),
      address: new FormControl('', Validators.required),
      city: new FormControl('', Validators.required),
      state: new FormControl('', Validators.required),
      zip: new FormControl('', Validators.required),
      phone: new FormControl('', Validators.required),
      fax: new FormControl(),
      email: new FormControl('', Validators.required),
      attestationCheck1: new FormControl('', Validators.required),
      attestationCheck2: new FormControl('', Validators.required),
      attestationCheck3: new FormControl('', Validators.required),
      attestationCheck4: new FormControl('', Validators.required),
      signature: new FormControl('', Validators.required),
    });
  }

  submit() {
    this.form.markAllAsTouched();
    this.form.markAsDirty();
  }
}
