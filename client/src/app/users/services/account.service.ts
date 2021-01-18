import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
    AppUser,
    UserCreationRequest,
    UpdateUserRequest,
} from 'app/interfaces';
import { map, takeUntil } from 'rxjs/operators';
import { BehaviorSubject, Subject, Observable } from 'rxjs';

@Injectable({providedIn: '***ARANGO_USERNAME***'})
export class AccountService implements OnDestroy {
    readonly accountApi = '/api/accounts';

    private completedSubjectsSource = new Subject<boolean>();
    private userListSource = new BehaviorSubject<AppUser[]>([]);
    readonly userList = this.userListSource.asObservable().pipe(takeUntil(this.completedSubjectsSource));

    constructor(private http: HttpClient) {}

    getUserList() {
        this.listOfUsers().subscribe((users: AppUser[]) => {
            this.userListSource.next(users);
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
    listOfUsers(username: string = ''): Observable<AppUser[]> {

        const hyperlink = username.length >= 1 ?
          `${this.accountApi}/?fields=username&filters=${username}` :
          `${this.accountApi}/`;

        return this.http.get<{result: AppUser[]}>(
            hyperlink,
        ).pipe(map(resp => resp.result));
    }

    currentUser() {
        return this.http.get<{result: AppUser}>(
            `${this.accountApi}/user`,
        ).pipe(map(resp => resp.result));
    }

    updateUser(updateRequest: UpdateUserRequest) {
        return this.http.put<{result: AppUser}>(
            `${this.accountApi}/user`,
            updateRequest,
        ).pipe(map(resp => resp.result));
    }

    ngOnDestroy() {
        this.completedSubjectsSource.next(true);
    }
}
