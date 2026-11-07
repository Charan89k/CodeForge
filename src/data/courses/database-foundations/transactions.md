## All of it, or none of it

Selling a book takes several writes: reduce the stock, record the order, record its lines. Now suppose the server crashes after the first one. Stock has gone down, and no sale exists. A transaction groups statements so that they succeed or fail as one.

Here is a small example, moving store credit between two customers.

```sql
CREATE TABLE credit (
  customer_id INTEGER PRIMARY KEY REFERENCES customers (id),
  balance     INTEGER NOT NULL CHECK (balance >= 0)
);

INSERT INTO credit VALUES (1, 500), (2, 100);

BEGIN;
UPDATE credit SET balance = balance - 200 WHERE customer_id = 1;
UPDATE credit SET balance = balance + 200 WHERE customer_id = 2;
COMMIT;

SELECT customer_id, balance FROM credit ORDER BY customer_id;
```

| customer_id | balance |
|---|---|
| 1 | 300 |
| 2 | 300 |

`COMMIT` makes the changes permanent and visible to others. Until then, you can change your mind.

```sql
BEGIN;
UPDATE credit SET balance = 0 WHERE customer_id = 1;
ROLLBACK;

SELECT balance FROM credit WHERE customer_id = 1;
```

| balance |
|---|
| 300 |

## What ACID promises

The four guarantees of a transaction have a well-known name.

| Letter | Stands for | Meaning |
|---|---|---|
| A | Atomicity | All of the statements happen, or none of them do |
| C | Consistency | Constraints hold before and after |
| I | Isolation | Concurrent transactions do not see each other's half-finished work |
| D | Durability | Once committed, it survives a crash |

Consistency is where your schema pays off. If a transfer would take a balance below zero, the `CHECK` constraint fails the statement, and the transaction can be rolled back. The rule holds no matter what bug is in the application.

```text
UPDATE credit SET balance = balance - 999 WHERE customer_id = 1;
ERROR:  new row for relation "credit" violates check constraint "credit_balance_check"
```

## The trouble with two people at once

Two staff sell the last copy of a book at the same moment. Each one reads the stock, sees 1, and sells it. This is a race, and reading then writing in application code is exactly how it happens.

```text
Time   Staff A                 Staff B
 1     reads stock: 1
 2                             reads stock: 1
 3     sets stock to 0
 4                             sets stock to 0
```

Two copies sold, one existed. The fix is to let the database make the check and the change as a single step, so only one can succeed.

```sql
CREATE TABLE stock (book_id INTEGER PRIMARY KEY REFERENCES books (id), copies INTEGER NOT NULL);
INSERT INTO stock VALUES (3, 1);

UPDATE stock SET copies = copies - 1 WHERE book_id = 3 AND copies > 0;

SELECT copies FROM stock WHERE book_id = 3;
```

| copies |
|---|
| 0 |

The second person's update then finds no row with `copies > 0`, and it changes nothing. The application checks how many rows changed and tells that customer the book is gone. Another option is `SELECT ... FOR UPDATE`, which locks a row until the transaction ends.

## Isolation levels

Stronger isolation means fewer surprises and more waiting or retries. PostgreSQL's default is Read Committed, where each statement sees only data committed before it began. Repeatable Read and Serializable go further. You will mostly stay on the default and use guarded updates or locks for specific races, as above.

> [!warning] Keep transactions short
> A transaction holds its locks until it ends, blocking anybody who needs those rows. Never wait for a person or a slow network call inside one.

## Try it

Why is `UPDATE stock SET copies = copies - 1 WHERE book_id = 3` not safe on its own, even though it is a single statement? It cannot lose an update, but nothing stops `copies` from going below zero. Either the `copies > 0` condition or a `CHECK (copies >= 0)` constraint fixes that, and using both is better still.

## Summary

- A transaction makes several statements succeed or fail as one.
- ACID describes the guarantees, and constraints protect you even from your own bugs.
- Let the database do the check and the change in one step, and keep transactions short.

:::quiz db-transactions
