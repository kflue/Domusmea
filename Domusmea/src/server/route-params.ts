/** Calls `fn` with the numeric id route parameter, or returns `undefined` for ids that cannot exist. */
export function withId<T>(param: string, fn: (id: number) => T): T | undefined {
  const id = Number(param);
  return Number.isSafeInteger(id) && id > 0 ? fn(id) : undefined;
}
