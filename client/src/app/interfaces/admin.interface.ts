export interface AppUser {
    id: number;
    email: string;
    username: string;
    roles: string[];
}

export interface UserCreationRequest {
    username: string;
    password: string;
    email: string;
    roles: string[];
}
