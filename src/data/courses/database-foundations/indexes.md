## Why queries get slow

To answer `WHERE city = 'Pune'` with no help, the database reads every row in the table. This is a sequential scan, and on a few hundred rows it is fine. On fifty million rows it means reading the whole table for each query.

## An index is a sorted lookup

An index works like the index at the back of a textbook. Instead of reading every page for "binary search", you look it up in a sorted list that tells you which pages to open.

```sql
CREATE INDEX customers_city_idx ON customers (city);
```

Most database indexes are B-trees: balanced, sorted structures in which finding a value takes only a few steps, even across millions of rows. If a course on algorithms taught you that halving a sorted range takes O(log n) steps, this is that idea in practice. Because the data is sorted, an index also speeds up ranges and `ORDER BY`.

The primary key already has an index, and so does anything marked `UNIQUE`. Foreign keys do not automatically get one in PostgreSQL, so you often add it yourself.

```sql
CREATE INDEX orders_customer_idx ON orders (customer_id);
CREATE INDEX order_items_book_idx ON order_items (book_id);
```

## Indexes have a cost

If indexes only helped, you would index everything. Each one takes storage and must be updated on every insert, update and delete of the columns it covers, so too many of them slow writes. Index what your queries really filter, join and sort on.

| Good candidates | Poor candidates |
|---|---|
| Foreign keys used in joins | Columns you never filter on |
| Columns often in `WHERE` | Very small tables |
| Columns you `ORDER BY` with a `LIMIT` | Columns where one value fills most rows |

## Columns in the right order

An index can cover several columns, and it sorts by the first, then the second within that. Think of a phone book, sorted by surname and then by first name. It helps you find everyone called Rao, and Asha Rao, but not everyone called Asha.

```sql
CREATE INDEX orders_customer_date_idx ON orders (customer_id, placed_on);
```

This helps `WHERE customer_id = 1` and `WHERE customer_id = 1 AND placed_on > '2026-01-15'`, but it is of little use to `WHERE placed_on > '2026-01-15'` on its own.

## Things that stop an index being used

An index on `title` is sorted by the exact text. If you search on something computed from it, the sorted order no longer helps.

- `WHERE LOWER(title) = 'graphs at work'` cannot use a plain index on `title`.
- `WHERE title LIKE '%Work'` cannot use it either, because a leading wildcard has no starting point. It is like looking up words by their last letter in a dictionary.
- `WHERE title LIKE 'Graphs%'` can use one, given a suitable index, because the start of the text is known.

## Ask the database what it did

Do not guess. `EXPLAIN` shows the plan, and `EXPLAIN ANALYZE` also runs the query and reports real timings.

```text
EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 42;

Index Scan using orders_customer_idx on orders
  Index Cond: (customer_id = 42)
  rows=12  actual time=0.031..0.044
```

The words to look for are `Seq Scan`, meaning every row was read, and `Index Scan`, meaning an index was used. A sequential scan is not always wrong. On a tiny table, or when a query matches most rows, reading everything really is faster, and the planner knows that. This is why you may not see your index used on the small tables in this course.

> [!insight] Measure, then index
> Find the slow query, read its plan, add the index it needs, and read the plan again. Adding indexes by intuition tends to produce many indexes and few improvements.

## Try it

A page shows a customer's ten latest orders: `WHERE customer_id = ? ORDER BY placed_on DESC LIMIT 10`. Which index would serve it best? The composite index above: it finds the customer and already has their orders sorted by date, so the database can read just ten entries.

## Summary

- An index is a sorted lookup that swaps extra storage and slower writes for faster reads.
- In a composite index, column order decides which queries it helps.
- Use `EXPLAIN` to see what the database really did.

:::quiz db-indexes
