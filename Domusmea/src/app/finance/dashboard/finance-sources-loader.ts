import { FinanceSource } from './finance-sources';

/** A source after loading; `figures` is `undefined` when it failed. */
export interface Loaded<S extends FinanceSource> {
  source: S;
  figures: Awaited<ReturnType<S['load']>> | undefined;
}

/** Loads every given source in parallel; one failing does not stop the others (R8). */
export async function loadAll<S extends FinanceSource>(
  sources: readonly S[],
  today: string,
): Promise<Loaded<S>[]> {
  const settled = await Promise.allSettled(sources.map((source) => source.load(today)));
  return sources.map((source, i) => {
    const result = settled[i];
    return {
      source,
      figures:
        result.status === 'fulfilled'
          ? (result.value as Awaited<ReturnType<S['load']>>)
          : undefined,
    };
  });
}
