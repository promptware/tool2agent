export type NonEmptyArray<T> = [T, ...T[]] & T[];

/** Ensures that at least one of the keys in the object is present. */
export type AtLeastOne<T, K extends keyof T = keyof T> = Omit<T, K> &
  {
    [P in K]: Required<Pick<T, P>> & Partial<Omit<T, P>>;
  }[K];

/** Ensures that at most one of the keys in the object is present. */
export type AtMostOne<T, K extends keyof T = keyof T> = Omit<T, K> &
  (
    | { [P in K]?: never } // none of K provided
    | { [P in K]: Required<Pick<T, P>> & Partial<Record<Exclude<K, P>, never>> }[K] // exactly one
  );
