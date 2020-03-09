import { FTSQueryRecord } from 'app/interfaces';

export interface State {
    query: string;
    nodes: Array<FTSQueryRecord>;
    total: number;
    page: number;
    limit: number;
    loading: boolean;
}

export const initialState: State = {
    query: '',
    nodes: null,
    total: null,
    page: null,
    limit: null,
    loading: false,
};
