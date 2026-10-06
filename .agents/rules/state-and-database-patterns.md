---
trigger: always_on
description: Invariants for database queries, global preference synchronization, UI state, and testing in the Trading Journal.
---

# State Management and Database Query Guidelines

## 1. Database Queries for "Active" or "Latest" Records
- When querying the "active", "current", or "latest" record with `.limit(1)`, NEVER omit the `orderBy` clause.
- Always explicitly order by update timestamp: `.orderBy(desc(table.updatedAt), desc(table.id))`.
- When updating a user preference or active record, explicitly set `updatedAt: new Date()` so subsequent queries reflect the change immediately.

## 2. Global Preferences & TRPC Cache Invalidation
- When a user changes a global context (such as active broker, active account, or theme):
  1. Optimistically update local React state and `localStorage` for zero-lag UI response.
  2. Use `utils.[scope].setData(undefined, newValue)` to immediately notify all mounted components subscribed to the query.
  3. Execute the server mutation and call `utils.[scope].invalidate()` on success to refresh dependent data across all routes.
- Ensure all pages consuming global state listen to query changes via `useEffect` if maintaining local filter state.

## 3. Radix UI Select Triggers
- Keep `<SelectTrigger>` clean: allow `<SelectValue placeholder="..." />` to directly render the selected item's content.
- Do not inject duplicate static icons or status dots inside `<SelectTrigger>` alongside `<SelectValue>`, as Radix clones the selected item's JSX into `<SelectValue>`.

## 4. Vitest Component Testing with React 19
- In TSX components and unit tests, always explicitly include `import React from "react";` to prevent `ReferenceError: React is not defined` during Vitest / jsdom execution.
