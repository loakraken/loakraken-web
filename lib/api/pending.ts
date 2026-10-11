/**
 * While new conditions load, a query with placeholderData: keepPreviousData
 * still shows the previous conditions' values. Those get dimmed in place and
 * marked busy, so no number passes for the new conditions (user 10-12).
 * Spread on the element that holds the numbers; same size, so CLS stays 0.
 */
export const pendingProps = (query: { isPlaceholderData: boolean }) =>
  query.isPlaceholderData ? ({ "aria-busy": true, "data-stale": "" } as const) : {};
