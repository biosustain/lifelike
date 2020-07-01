import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { ProjectSpaceService, Collaborator, Project } from '../../services/project-space.service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormArray, FormGroup, FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-edit-project-dialog',
  templateUrl: './edit-project-dialog.component.html',
  styleUrls: ['./edit-project-dialog.component.scss']
})
export class EditProjectDialogComponent implements OnInit, OnDestroy {
  @Input()
  set project(proj: Project) {
    this.PROJECT = proj;

    // Pull list of collaborators as we
    // get new project
    this.projSpace.getCollaborators(
      proj.projectName
    ).subscribe(
      collabs => {
        this.collabs = collabs;

        const listOfFormGroups = collabs.map(
          (c: Collaborator, index: number) => new FormGroup({
            username: new FormControl(c.username),
            role: new FormControl(c.role),
            id: new FormControl(c.id)
          })
        );

        this.collabForm.setControl(
          'currentCollabs',
          new FormArray(listOfFormGroups)
        );

        listOfFormGroups.map(
          (fg: FormGroup) => {
            const subscription = fg.valueChanges.subscribe(
              val => this.updateCollaborator(val)
            );
            return subscription;
          }
        );
      }
    );
  }
  get project() {
    return this.PROJECT;
  }

  PROJECT: Project = null;

  userRoles = [
    {
      value: 'project-admin',
      label: 'Admin'
    }, {
      value: 'project-read',
      label: 'Read'
    }, {
      value: 'project-write',
      label: 'Write'
    },
    {
      value: 'delete',
      label: 'Remove user'
    }
  ];

  /**
   * Manages existing and pending collabs
   */
  collabForm: FormGroup = new FormGroup({
    pendingCollabs: new FormArray([]),
    currentCollabs: new FormArray([])
  });
  get pendingCollabs(): FormArray {
    return this.collabForm.get('pendingCollabs') as FormArray;
  }
  get currentCollabs(): FormArray {
    return this.collabForm.get('currentCollabs') as FormArray;
  }
  collabs: Collaborator[] = [];


  collabFormSubscription: Subscription[] = [];

  constructor(
    private projSpace: ProjectSpaceService,
    public activeModal: NgbActiveModal
  ) { }

  ngOnInit() {}

  ngOnDestroy() {
    this.collabFormSubscription.map(
      (sub: Subscription) => sub.unsubscribe()
    );
  }

  doNothing() {
    this.activeModal.dismiss();
  }

  /**
   * Append to the pending collab form
   * with a new form entry for the end-user
   */
  addCollabForm() {
    this.pendingCollabs.push(new FormGroup({
      username: new FormControl(''),
      role: new FormControl('project-read')
    }));
  }

  /**
   * Remove form entry from pending-collab-form
   * from the given index
   * @param i - index of the form entry to remove
   */
  removeCollabForm(i) {
    this.pendingCollabs.removeAt(i);
  }

  /**
   * Call API to add collaborator with specified privilege
   * @param i - index of form entry to add collab
   */
  addCollaborator(i) {
    // TODO - check if username isn't blank
    // TODO - check if response failed like username doesn't exist

    const {
      username,
      role
    } = this.pendingCollabs.at(i).value;

    this.projSpace.addCollaborator(
      this.project.projectName,
      username,
      role
    ).subscribe(resp => {
      this.collabs.push({
        role,
        username
      });

      const fg = new FormGroup({
        username: new FormControl(username),
        role: new FormControl(role)
      });
      this.currentCollabs.push(fg);

      const subscription = fg.valueChanges.subscribe(val => this.updateCollaborator(val));
      this.collabFormSubscription.push(subscription);

      // Removing from the pending collab form
      this.pendingCollabs.removeAt(i);
    });
  }

  /**
   *
   * @param value - represent user to add
   */
  updateCollaborator(value) {
    const {
      username,
      role,
      id
    } = value;

    // Check if the user privilege is the same to prevent
    // redundant change
    const curCollab = this.collabs.filter(c => c.id === id)[0];
    if (curCollab.role === role) {
      console.log('here');
      return;
    } else if (role === 'delete') {
      // Remove the user from the list
      this.projSpace.removeCollaborator(
        this.project.projectName,
        username
      ).subscribe(resp => {
        const index = (
          this.currentCollabs.value as any[]
        ).findIndex(c => c.id === id);

        this.currentCollabs.removeAt(index);
        this.collabs = this.collabs.filter(c => c.id !== id);
      });
    } else {
      this.projSpace.editCollaborator(
        this.project.projectName,
        username,
        role
      ).subscribe(resp => {
        console.log(resp);
      });
    }


  }

}
