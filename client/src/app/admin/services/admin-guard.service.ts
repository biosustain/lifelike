import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot } from '@angular/router';
import { AdminService } from './admin.service';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AppUser } from 'app/interfaces';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private adminService: AdminService, public snackBar: MatSnackBar) {}

    canActivate(_: ActivatedRouteSnapshot): Observable<boolean> {
        return this.adminService.currentUser().pipe(
            map((user: AppUser) => {
                const isAdmin = user.roles.includes('admin');
                if (!isAdmin) {
                    this.openSnackBar('Unauthorized', 'close');
                }
                return isAdmin;
            }),
            take(1),
        );
    }

    openSnackBar(message: string, action: string) {
        this.snackBar.open(message, action, {duration: 5000});
    }
}
