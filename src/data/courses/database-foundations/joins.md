## Putting split data back together

Normalising split facts into separate tables. A join brings them back for a query. It pairs rows from two tables wherever a condition holds, nearly always a foreign key matching the key it points to.

```sql
SELECT b.title, a.name
FROM books b
JOIN authors a ON a.id = b.author_id
ORDER BY b.id;
```

| title | name |
|---|---|
| Practical SQL Notes | R. Menon |
| Indexing by Hand | R. Menon |
| Graphs at Work | L. Sato |
| Tides and Tables | L. Sato |

`b` and `a` are short aliases, which save typing and make it clear where each column comes from.

Look at what is missing. `Anonymous Recipes` has no author, so it has no match, and D. Okafor has no books. An inner join, which is what plain `JOIN` means, keeps only rows that match on both sides.

## LEFT JOIN keeps the unmatched

A `LEFT JOIN` keeps every row from the left table. Where there is no match, the right side's columns are `NULL`.

```sql
SELECT a.name, b.title
FROM authors a
LEFT JOIN books b ON b.author_id = a.id
WHERE b.id IS NULL;
```

| name | title |
|---|---|
| D. Okafor | NULL |

That pairing of `LEFT JOIN` with `IS NULL` is the standard way to ask for things that have no match: authors with no books, customers with no orders.

> [!tip] Which join do I want?
> Ask whether a row should disappear when it has no partner. If yes, use `JOIN`. If no, use `LEFT JOIN`. Reports that quietly leave out customers usually have an inner join where a left join was meant.

## Joining through a table

Questions often cross several tables. To get what Asha bought, walk the relationships one at a time, from customer to order to order line to book.

```sql
SELECT o.id AS order_id, b.title, i.quantity
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items i ON i.order_id = o.id
JOIN books b ON b.id = i.book_id
WHERE c.name = 'Asha'
ORDER BY o.id, b.title;
```

| order_id | title | quantity |
|---|---|---|
| 1 | Graphs at Work | 2 |
| 1 | Practical SQL Notes | 1 |
| 2 | Indexing by Hand | 1 |

Picture each `JOIN` as widening the result with more columns. Each row here is one order line, carrying everything we know about it.

## Mind what multiplies

A join returns one row per matching pair, so rows can multiply. Asha has one row in `customers`, but she appears three times above. That is correct for a list of order lines, but it would be wrong if you were counting customers.

```sql
SELECT COUNT(*) AS rows_returned, COUNT(DISTINCT c.id) AS customers
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items i ON i.order_id = o.id;
```

| rows_returned | customers |
|---|---|
| 4 | 2 |

Before trusting a total over a join, ask what one row of the result represents.

> [!warning] Forgetting the ON
> A join without a condition pairs every row with every row. Two tables of 1,000 rows give a million. If a result is suddenly enormous, check your `ON` clauses.

## Try it

Which customers have never placed an order? Try it, then compare.

```sql
SELECT c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;
```

| name |
|---|
| Meena |

## Summary

- `JOIN` keeps only matching rows, and `LEFT JOIN` keeps every row from the left table.
- `LEFT JOIN` with `IS NULL` finds things with no match.
- Joins can multiply rows, so always know what one result row means.

:::quiz db-joins
