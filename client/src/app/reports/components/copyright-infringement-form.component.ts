import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-copyright-infringement-form',
  templateUrl: './copyright-infringement-form.component.html',
  styleUrls: ['./copyright-infringement-form.component.scss']
})
export class CopyrightInfringementFormComponent implements OnInit {

  form: FormGroup;

  constructor() { }

  // TODO: Add validation to UI

  ngOnInit(): void {
    this.form = new FormGroup({
      url: new FormControl('', Validators.required),
      description: new FormControl('', Validators.required),
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
  }
}
