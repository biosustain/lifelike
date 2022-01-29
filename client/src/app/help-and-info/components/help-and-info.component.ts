import { Component, OnInit } from '@angular/core';

interface SubTopic {
  name: string;
  description: string;
  link: string;
}

interface Topic {
  name: string;
  subTopics: SubTopic[];
}

@Component({
  selector: 'app-help-and-info',
  templateUrl: './help-and-info.component.html',
  styleUrls: ['./help-and-info.component.scss']
})
export class HelpAndInfoComponent implements OnInit {
  topics: Topic[];
  selectedTopic: number;

  constructor() { }

  ngOnInit(): void {
    this.topics = [
      {
        name: 'Policies',
        subTopics: [
          {
            name: 'Terms & Conditions',
            description: 'View the terms and conditions for Lifelike.',
            link: '/policies/terms-and-conditions'
          },
          {
            name: 'Privacy Policy',
            description: 'View the privacy policy for Lifelike.',
            link: '/policies/privacy-policy'
          },
          {
            name: 'Cookie Policy',
            description: 'View the cookie policy for Lifelike.',
            link: '/policies/cookie-policy'
          },
        ],
      },
      {
        name: 'Claims',
        subTopics: [
          {
            name: 'Copyright Infringement',
            description: 'Submit a copyright infringement request form.',
            link: 'claims/copyright-infringement'
          },
        ],
      }
    ];
    this.selectedTopic = 0;
  }

  selectTopic(topicIdx: number) {
    this.selectedTopic = topicIdx;
  }
}
