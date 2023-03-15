import { PipeStatus } from '../../pipes/add-status.pipe';

export const pipeStatusLoadingMock = <T>(value: T) => ({
  loading: true,
  value
} as PipeStatus<T>);
