## Adding some data

Every example from here on uses the same small bookshop, so add its rows now. Author 3 has no books yet, and one book has no recorded author. Both are there on purpose.

```sql
INSERT INTO authors (id, name) VALUES
  (1, 'R. Menon'), (2, 'L. Sato'), (3, 'D. Okafor');

INSERT INTO books (id, title, author_id, price, year) VALUES
  (1, 'Practical SQL Notes', 1, 450, 2021),
  (2, 'Indexing by Hand', 1, 600, 2023),
  (3, 'Graphs at Work', 2, 750, 2019),
  (4, 'Anonymous Recipes', NULL, 300, 2020),
  (5, 'Tides and Tables', 2, 350, 2024);

INSERT INTO customers (id, name, city) VALUES
  (1, 'Asha', 'Mumbai'), (2, 'Ravi', 'Pune'), (3, 'Meena', 'Mumbai');

INSERT INTO orders (id, customer_id, placed_on) VALUES
  (1, 1, '2026-01-10'), (2, 1, '2026-02-02'), (3, 2, '2026-02-15');

INSERT INTO order_items (order_id, book_id, quantity) VALUES
  (1, 1, 1), (1, 3, 2), (2, 2, 1), (3, 1, 3);
```

## SELECT picks columns, WHERE picks rows

```sql
SELECT title, price
FROM books
WHERE price >= 450
ORDER BY price DESC;
```

| title | price |
|---|---|
| Graphs at Work | 750 |
| Indexing by Hand | 600 |
| Practical SQL Notes | 450 |

Without `ORDER BY`, the database may return rows in any order, and that order can change. If order matters, ask for it.

Conditions combine with `AND`, `OR`, `IN` and `BETWEEN`, and `LIKE` matches patterns, where `%` stands for any run of characters.

```sql
SELECT title
FROM books
WHERE year BETWEEN 2020 AND 2023
  AND title LIKE '%Notes%';
```

| title |
|---|
| Practical SQL Notes |

## NULL means unknown

`NULL` is not a value you can compare with. `author_id = NULL` is never true, even for rows where it is missing, because asking whether something unknown equals something unknown has the answer "unknown". Use `IS NULL`.

```sql
SELECT title
FROM books
WHERE author_id IS NULL;
```

| title |
|---|
| Anonymous Recipes |

> [!warning] A common silent bug
> `WHERE author_id = NULL` raises no error. It just returns nothing, and that is easy to mistake for "no such rows". Always use `IS NULL` and `IS NOT NULL`.

## Computing and limiting

You can compute in the `SELECT` list and name the result with `AS`. `LIMIT` caps the number of rows.

```sql
SELECT title, price * 90 / 100 AS sale_price
FROM books
ORDER BY sale_price
LIMIT 2;
```

| title | sale_price |
|---|---|
| Anonymous Recipes | 270 |
| Tides and Tables | 315 |

`DISTINCT` removes duplicate rows from the result, which answers questions like "which cities do we have customers in?"

```sql
SELECT DISTINCT city
FROM customers
ORDER BY city;
```

| city |
|---|
| Mumbai |
| Pune |

## Changing rows

`UPDATE` and `DELETE` use the same `WHERE` idea.

```sql
UPDATE books SET price = 400 WHERE id = 5;

SELECT title, price FROM books WHERE id = 5;
```

| title | price |
|---|---|
| Tides and Tables | 400 |

> [!warning] Always check the WHERE
> `UPDATE books SET price = 400` with no `WHERE` changes every row. A good habit is to first run a `SELECT` with the same condition and look at what it matches.

## Try it

List the titles of books published from 2021 onwards, cheapest first. Try it, then compare.

```sql
SELECT title
FROM books
WHERE year >= 2021
ORDER BY price;
```

| title |
|---|
| Tides and Tables |
| Practical SQL Notes |
| Indexing by Hand |

## Summary

- `SELECT` chooses columns, `WHERE` chooses rows and `ORDER BY` sets the order.
- `NULL` means unknown, so test it with `IS NULL`, never `=`.
- Check a condition with `SELECT` before using it to update or delete.

:::quiz db-asking-questions
