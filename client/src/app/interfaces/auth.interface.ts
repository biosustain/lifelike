export interface AppUser {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    username: string;
    roles: string[];
}

export interface ChangePasswordRequest {
    user: AppUser;
    oldPassword: string;
    newPassword: string;
}

export interface Credential {
    email: string;
    password: string;
}
