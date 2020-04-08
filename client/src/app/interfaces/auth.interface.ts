export interface AppUser {
    id: number;
    email: string;
    username: string;
    roles: string[];
}

export interface Credential {
    email: string;
    password: string;
}
