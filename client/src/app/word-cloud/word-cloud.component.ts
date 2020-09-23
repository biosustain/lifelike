import {Component, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {ActivatedRoute} from '@angular/router';

@Component({
  selector: 'app-word-cloud',
  templateUrl: './word-cloud.component.html',
  styleUrls: ['./word-cloud.component.scss']
})
export class WordCloudComponent implements OnInit {
  paramsSubscription: Subscription;
  projectName: string;
  fileId: string;

  constructor(readonly route: ActivatedRoute) {
    this.paramsSubscription = this.route.params.subscribe(param => {
      this.projectName = param.project_name;
      this.fileId = param.file_id;
    });
  }

  ngOnInit() {
  }

}
