import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { AppUser } from 'app/interfaces';

@Component({
    selector: 'app-user-profile',
    templateUrl: './user-profile.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfileComponent implements OnInit {

    @Input() user: AppUser;

    profileForm = new FormGroup({
        username: new FormControl({value: '', disabled: true}),
        firstName: new FormControl({value: '', disabled: true}),
        lastName: new FormControl({value: '', disabled: true}),
        email: new FormControl({value: '', disabled: true}),
    });

    constructor() {}

    ngOnInit() {
        this.profileForm.reset({
            username: this.user.username,
            firstName: this.user.firstName,
            lastName: this.user.lastName,
            email: this.user.email,
        });
    }
}
