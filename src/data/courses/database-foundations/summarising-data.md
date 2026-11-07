## Questions about many rows

So far each result row has described one thing. Many real questions are about groups: how many, how much, which is largest. Aggregate functions collapse many rows into one answer.

```sql
SELECT COUNT(*) AS books, MIN(price) AS cheapest, MAX(price) AS dearest, SUM(price) AS total
FROM books;
```

| books | cheapest | dearest | total |
|---|---|---|---|
| 5 | 300 | 750 | 2500 |

`COUNT(*)` counts rows, whereas `COUNT(author_id)` counts rows where that column is not `NULL`. On this table, those give 5 and 4. Aggregates skip `NULL`s, and that can be a surprise with `AVG`.

## GROUP BY makes one row per group

`GROUP BY` splits the rows into groups and runs the aggregate on each.

```sql
SELECT city, COUNT(*) AS customers
FROM customers
GROUP BY city
ORDER BY city;
```

| city | customers |
|---|---|
| Mumbai | 2 |
| Pune | 1 |

The rule to remember: every column in the `SELECT` must either be in `GROUP BY` or be inside an aggregate. Otherwise, which row's value would it show?

## Aggregating across joins

Now the bookshop's real question: how many copies of each book have we sold, and for how much?

```sql
SELECT b.title, SUM(i.quantity) AS copies, SUM(i.quantity * b.price) AS revenue
FROM order_items i
JOIN books b ON b.id = i.book_id
GROUP BY b.id, b.title
ORDER BY revenue DESC;
```

| title | copies | revenue |
|---|---|---|
| Practical SQL Notes | 4 | 1800 |
| Graphs at Work | 2 | 1500 |
| Indexing by Hand | 1 | 600 |

Books that never sold are missing, because this is an inner join. To include them, start from `books` with a `LEFT JOIN`, and use `COALESCE`, which replaces a `NULL` with a value you choose.

```sql
SELECT b.title, COALESCE(SUM(i.quantity), 0) AS copies
FROM books b
LEFT JOIN order_items i ON i.book_id = b.id
GROUP BY b.id, b.title
ORDER BY copies DESC, b.title;
```

| title | copies |
|---|---|
| Practical SQL Notes | 4 |
| Graphs at Work | 2 |
| Indexing by Hand | 1 |
| Anonymous Recipes | 0 |
| Tides and Tables | 0 |

## WHERE filters rows, HAVING filters groups

`WHERE` runs before grouping, so it cannot see totals. `HAVING` runs after. This query asks which customers have ordered more than once.

```sql
SELECT c.name, COUNT(*) AS orders
FROM customers c
JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name
HAVING COUNT(*) > 1;
```

| name | orders |
|---|---|
| Asha | 2 |

It helps to know the order in which a query is logically worked out, which differs from how it is written.

1. `FROM` and `JOIN` build the rows.
2. `WHERE` removes rows.
3. `GROUP BY` forms groups.
4. `HAVING` removes groups.
5. `SELECT` computes the output.
6. `ORDER BY` sorts it, and `LIMIT` cuts it.

This is why `WHERE` cannot use a `SELECT` alias or an aggregate: neither exists yet at that point.

## Subqueries: one question inside another

A query can use the answer to another. Which books cost more than the average?

```sql
SELECT title
FROM books
WHERE price > (SELECT AVG(price) FROM books)
ORDER BY title;
```

| title |
|---|
| Graphs at Work |
| Indexing by Hand |

## Try it

For each month, how many orders were placed? `TO_CHAR` formats a date in PostgreSQL; other databases have their own function for this.

```sql
SELECT TO_CHAR(placed_on, 'YYYY-MM') AS month, COUNT(*) AS orders
FROM orders
GROUP BY month
ORDER BY month;
```

| month | orders |
|---|---|
| 2026-01 | 1 |
| 2026-02 | 2 |

## Summary

- Aggregates collapse rows, and `GROUP BY` gives one result row per group.
- `WHERE` filters rows before grouping, and `HAVING` filters groups after.
- Use `LEFT JOIN` with `COALESCE` when groups with no rows should still appear.

:::quiz db-summarising-data
