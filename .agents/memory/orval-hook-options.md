---
name: Orval hook options (TanStack Query v5)
description: Correct patterns for passing custom options to Orval-generated hooks
---

## queryKey is required — spread the helper

`UseQueryOptions` in TanStack Query v5 requires `queryKey`. Orval generates hooks where the key is provided internally, but the TypeScript type is strict. Passing `{ query: { retry: false } }` causes TS2741.

**Fix:** Spread `getXxxQueryOptions()` (the generated options helper) to include the queryKey, then override:

```ts
useGetVoterSession({
  query: { ...getGetVoterSessionQueryOptions(), retry: false },
})
```

Note: spread the return value directly — NOT `.query` on the return value. `getXxxQueryOptions()` returns `UseQueryOptions & { queryKey }` directly.

## List hooks — params are positional, not inside options

Orval generates list hooks with params as the **first positional argument**, not wrapped in an object:

```ts
// WRONG
useListVoters({ params: { page: 1, limit: 50 } })

// CORRECT
useListVoters({ page: 1, limit: 50 }, options?)
```

**Why:** The Orval generated signature is `useListXxx(params?: XxxParams, options?: { query?: ... })`.
