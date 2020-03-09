export interface ApiHttpError {
    name: string;
    message: string;
}

export interface ServerError {
    serverError: ApiHttpError;
    status: number;
}
