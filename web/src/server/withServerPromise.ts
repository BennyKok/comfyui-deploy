export async function wrapServerPromise<T>(result: Promise<T>) {
  return result.catch((error) => {
    return {
      error: error.message,
    };
  });
}
export function withServerPromise<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => Promise<ReturnType<T> | { error: string; }> {
  return (...args: Parameters<T>) => wrapServerPromise(fn(...args));
}
