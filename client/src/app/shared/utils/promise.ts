export const timeoutPromise = <T>(prom: Promise<T>, time: number) =>
  Promise.race<Promise<T>>([
    prom,
    new Promise((_, reject) => setTimeout(reject, time)),
  ]);
