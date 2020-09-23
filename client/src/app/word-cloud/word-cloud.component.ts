import {Component, OnInit, SimpleChanges, ViewChild} from '@angular/core';
import {Observable, of, Subscription} from 'rxjs';
import {ActivatedRoute} from '@angular/router';
import {CloudData, CloudOptions, TagCloudComponent} from 'angular-tag-cloud-module';
import {WordCloudService} from './services/word-cloud.service';

@Component({
  selector: 'app-word-cloud',
  templateUrl: './word-cloud.component.html',
  styleUrls: ['./word-cloud.component.scss']
})

export class WordCloudComponent implements OnInit {
  @ViewChild(TagCloudComponent, {static: false}) tagCloudComponent: TagCloudComponent;
  paramsSubscription: Subscription;
  projectName: string;
  fileId: string;
  annotations: any[] = [];

  // please refer to this documentation: https://github.com/d-koppenhagen/angular-tag-cloud-module \
  // to see different options

  options: CloudOptions = {
    width: 0.98,
    height: 500,
    overflow: false,
    realignOnResize: true,
    randomizeAngle: true,
    step: 5,
    font: 'italic bold 14px "Georgia", cursive'
  };

  data: CloudData[] = [];

  constructor(
      readonly route: ActivatedRoute,
      readonly wordCloudService: WordCloudService
  ) {
    this.paramsSubscription = this.route.params.subscribe(param => {
      this.projectName = param.project_name;
      this.fileId = param.file_id;
    });
  }

  ngOnInit() {
    this.getAnnotationsForFile();
  }

  getAnnotationsForFile() {
    this.wordCloudService.getCombinedAnnotations(this.projectName, this.fileId)
        .subscribe(data => {
          const list = data.split('\n');
          const newData: CloudData[] = [];
          list.forEach(e => this.annotations.push(e));
          // remove the headers from tsv response
          this.annotations.shift();
          // remove empty line at the end of the tsv response
          this.annotations.pop();
          this.annotations.forEach(e => {
            const annotation = e.split('\t');
            newData.push({text: annotation[2], weight: parseInt(annotation[3], 10)});

          });
          // NOTE: You can remove the limit to show all words but this make completely unreadable the word cloud
          this.setData(newData.slice(0, 51));
        });
  }

  private setData(data: CloudData[]) {
    this.data = data;
  }

}
