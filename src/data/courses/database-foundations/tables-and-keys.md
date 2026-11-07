## One table for each kind of thing

Designing a schema starts with nouns. Our bookshop has authors, books, customers and orders. Each becomes a table, and each column gets a type that the database enforces.

```sql
CREATE TABLE authors (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
```

`NOT NULL` says a value is required. Without it, a column may hold `NULL`, which means "unknown" rather than zero or empty.

## Primary keys identify a row

A primary key is a column whose value is unique and never missing, so you can always point at exactly one row. Names make poor keys, because two authors can share one and people change theirs. Use a meaningless id, one that has no reason to ever change.

## Foreign keys connect tables

A book has an author. We do not copy the author's name into the book. We store the author's id, and declare the link.

```sql
CREATE TABLE books (
  id        INTEGER PRIMARY KEY,
  title     TEXT NOT NULL,
  author_id INTEGER REFERENCES authors (id),
  price     INTEGER NOT NULL CHECK (price >= 0),
  year      INTEGER NOT NULL
);
```

`REFERENCES` is a foreign key. The database now refuses a book whose `author_id` points at no author, and refuses to delete an author who still has books. A mistake that a spreadsheet would keep silently becomes an error at once.

`CHECK` adds a rule of your own. Prices are whole rupees here, because, as with money in code, whole numbers avoid rounding errors.

## Three kinds of relationship

Every link between tables is one of three shapes.

| Shape | Example | How to store it |
|---|---|---|
| One to many | One customer has many orders | Foreign key on the "many" side |
| One to one | One customer has one loyalty card | Foreign key with `UNIQUE` |
| Many to many | An order has many books, and a book is in many orders | A third table joining them |

Here are customers and orders, a one-to-many relationship.

```sql
CREATE TABLE customers (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL
);

CREATE TABLE orders (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers (id),
  placed_on   DATE NOT NULL
);
```

Many to many needs a table of its own, because a single column cannot hold several books. Each row of the joining table is one line of an order, which is also the natural home for facts about that pairing, such as the quantity.

```sql
CREATE TABLE order_items (
  order_id INTEGER NOT NULL REFERENCES orders (id),
  book_id  INTEGER NOT NULL REFERENCES books (id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (order_id, book_id)
);
```

The primary key spans two columns: the same book cannot appear twice on one order.

> [!tip] Sketch before you type
> Draw a box for each table and a line for each relationship, marking the "many" end. Ten minutes on paper is much cheaper than changing a live schema later.

## Try it

Add a `reviews` table: a customer gives a book a rating from 1 to 5, and may only review each book once. Which columns, and which constraints? Try it, then compare.

```sql
CREATE TABLE reviews (
  customer_id INTEGER NOT NULL REFERENCES customers (id),
  book_id     INTEGER NOT NULL REFERENCES books (id),
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  PRIMARY KEY (customer_id, book_id)
);
```

The two-column primary key is what enforces "once".

## Summary

- Each kind of thing gets a table, and each column has a type and rules.
- Primary keys identify rows, and foreign keys link them while keeping those links valid.
- Many-to-many relationships need a joining table.

:::quiz db-tables-and-keys
