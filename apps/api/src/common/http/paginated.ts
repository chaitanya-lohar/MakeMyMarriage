/**
 * A page of a cursor-paginated list. Returned by a handler, it is rendered as
 * `{ data: items, meta: { …, pagination: { nextCursor, hasNextPage }, …extraMeta } }`
 * (API Design §20). `extraMeta` carries list-wide figures, such as expense totals.
 */
export class Paginated<T> {
  constructor(
    readonly items: T[],
    readonly nextCursor: string | null,
    readonly extraMeta: Record<string, unknown> = {},
  ) {}
}
