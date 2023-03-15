import { Component, OnInit, Input } from '@angular/core';

import { Collaborator } from '../../../models/collaborator';

@Component({
  selector: 'app-collaborator-table',
  templateUrl: './collaborator-table.component.html',
  styleUrls: ['./collaborator-table.component.scss']
})
export class CollaboratorTableComponent {
  @Input() collaborators: Collaborator[];
}
