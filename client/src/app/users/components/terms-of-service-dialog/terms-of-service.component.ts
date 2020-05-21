import { Component, OnInit, Inject } from '@angular/core';

@Component({
  selector: 'app-terms-of-service',
  templateUrl: './terms-of-service-dialog.component.html',
  styleUrls: ['./terms-of-service-dialog.component.scss']
})
export class TermsOfServiceComponent implements OnInit {
  dialogMode = false;

  constructor() { }

  ngOnInit() { }

  agree() { }
  disagree() { }
}
