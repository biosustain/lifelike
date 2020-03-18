import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AppUser, UserCreationRequest } from 'app/interfaces';
import { map } from 'rxjs/operators';


@Injectable()
export class AdminService {
    readonly adminApi = '/api/accounts';

    constructor(private http: HttpClient) {}

    createUser(request: UserCreationRequest) {
        return this.http.post<{result: AppUser}>(
            `${this.adminApi}/`, request,
        ).pipe(map(resp => resp.result));
    }

    currentUser() {
        return this.http.get<{result: AppUser}>(
            `${this.adminApi}/user`
        ).pipe(map(resp => resp.result));
    }

    listOfUsers() {
        return this.http.get<{result: AppUser[]}>(
            `${this.adminApi}/`,
        ).pipe(map(resp => resp.result));
    }
}
