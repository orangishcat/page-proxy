export type Result<T> =
  | {ok: true; value: T}
  | {ok: false; error: string};

export const ok = <T>(value: T): Result<T> => ({ok: true, value});
export const err = (error: string): Result<never> => ({ok: false, error});

export const isResultError = <T>(
  result: Result<T>
): result is {ok: false; error: string} => !result.ok;
