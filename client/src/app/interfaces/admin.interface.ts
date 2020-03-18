export interface AppUser {
    id: number;
    email: string;
    username: string;
}

export interface UserCreationRequest {
    username: string;
    password: string;
    email: string;
    roles: string[];
}
