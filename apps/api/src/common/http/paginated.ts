/**
 * A page of a cursor-paginated list. Returned by a handler, it is rendered as
 * `{ data: items, meta: { …, pagination: { nextCursor, hasNextPage } } }` (API Design §20).
 */
export class Paginated<T> {
  constructor(
    readonly items: T[],
    readonly nextCursor: string | null,
  ) {}
}
