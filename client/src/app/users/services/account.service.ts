import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
    AppUser,
    UserCreationRequest,
    ChangePasswordRequest,
    PrivateAppUser,
} from 'app/interfaces';
import { ResultList } from 'app/shared/schemas/common';
import { map, takeUntil } from 'rxjs/operators';
import { BehaviorSubject, Subject, Observable } from 'rxjs';

@Injectable({providedIn: 'root'})
export class AccountService implements OnDestroy {
    readonly accountApi = '/api/accounts';

    private completedSubjectsSource = new Subject<boolean>();
    private userListSource = new BehaviorSubject<AppUser[]>([]);
    readonly userList = this.userListSource.asObservable().pipe(takeUntil(this.completedSubjectsSource));

    constructor(private http: HttpClient) {}

    getUserList() {
        this.listOfUsers().subscribe((data: ResultList<PrivateAppUser>) => {
            this.userListSource.next(data.results);
        });
    }

    createUser(request: UserCreationRequest) {
        return this.http.post<{result: AppUser}>(
            `${this.accountApi}/`, request,
        ).pipe(map(resp => resp.result));
    }

    /**
     * Return list of users
     * @param username - optional val to query against list of users
     */
    listOfUsers(): Observable<ResultList<PrivateAppUser>> {
        return this.http.get<ResultList<PrivateAppUser>>(`${this.accountApi}/`);
    }

    currentUser() {
        return this.http.get<AppUser>(
            `${this.accountApi}/user`,
        ).pipe(
            map(resp => resp),
        );
    }

    changePassword(updateRequest: ChangePasswordRequest) {
        const { hashId, newPassword, password } = updateRequest;
        return this.http.post(
            `${this.accountApi}/${hashId}/change-password`,
            {newPassword, password},
        );
    }

    ngOnDestroy() {
        this.completedSubjectsSource.next(true);
    }
}
