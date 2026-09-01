/**
 * A promise whose resolution the test controls, for asserting on
 * intermediate ("in flight") states rather than only the final result.
 *
 * @example
 *   const call = deferred<{ error: null }>();
 *   someMock.mockReturnValue(call.promise);
 *   // ...assert the pending UI...
 *   call.resolve({ error: null });
 */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}
