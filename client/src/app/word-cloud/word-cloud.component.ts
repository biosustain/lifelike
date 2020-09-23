import {Component, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {ActivatedRoute} from '@angular/router';
import {CloudData, CloudOptions} from 'angular-tag-cloud-module';

@Component({
  selector: 'app-word-cloud',
  templateUrl: './word-cloud.component.html',
  styleUrls: ['./word-cloud.component.scss']
})
export class WordCloudComponent implements OnInit {
  paramsSubscription: Subscription;
  projectName: string;
  fileId: string;
  options: CloudOptions = {
    width: 0.98,
    height: 500,
    overflow: false
  };
  data: CloudData[] = [
    {text: 'Weight-9-link', weight: 10},
    {text: 'Weight-10-link', weight: 9},
    {text: 'Weight-11-link', weight: 8},
    {text: 'Weight-12-link', weight: 7},
    {text: 'Weight-13-link', weight: 6},
    {text: 'Weight-14-link', weight: 5},
    {text: 'Weight-15-link', weight: 4},
    {text: 'Weight-16-link', weight: 3},
    {text: 'Weight-17-link', weight: 2},
    {text: 'Weight-18-link', weight: 1},
    {text: 'Weight-19-link', weight: 0}
  ];

  constructor(readonly route: ActivatedRoute) {
    this.paramsSubscription = this.route.params.subscribe(param => {
      this.projectName = param.project_name;
      this.fileId = param.file_id;
    });
  }

  ngOnInit() {
  }

}
