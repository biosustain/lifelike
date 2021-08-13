import { Component, Input, TemplateRef } from '@angular/core';
import { TaskStatus } from '../../rxjs/background-task';
import { PipeStatus } from '../../pipes/add-status.pipe';

@Component({
  selector: 'app-status-placeholders',
  templateUrl: './status-placeholders.component.html',
  styleUrls: ['./status-placeholders.component.scss']
})
export class StatusPlaceholdersComponent {
  @Input() status: TaskStatus|PipeStatus<any>;
  @Input() progressTemplate: TemplateRef<any>;
  @Input() errorTemplate: TemplateRef<any>;
  requestRefresh;
}
