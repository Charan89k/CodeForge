## A small project from start to finish

This lesson uses the whole course on one design. A college library wants software that tracks its books, and it describes the need this way:

> The library owns several copies of each title. Members borrow a copy for 14 days. We need to know who has what, what is overdue, and which titles are most popular. A copy can only be with one member at a time.

## Step 1: find the nouns

Title, copy, member and loan. Notice that "book" hides two things: a title, such as *Graphs at Work*, and a physical copy of it with its own barcode. Separating them is the key decision here, because a member borrows a copy, not a title.

## Step 2: find the relationships

- One title has many copies, so copies carry a foreign key.
- A member and a copy are linked through loans. Over time, each member has many loans and each copy has many loans, so it is many to many, and the loan is itself a real thing with its own facts, namely its dates.

## Step 3: write the tables

```sql
CREATE TABLE lib_titles (
  id    INTEGER PRIMARY KEY,
  title TEXT NOT NULL
);

CREATE TABLE lib_copies (
  id       INTEGER PRIMARY KEY,
  title_id INTEGER NOT NULL REFERENCES lib_titles (id),
  barcode  TEXT NOT NULL UNIQUE
);

CREATE TABLE lib_members (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE lib_loans (
  id          INTEGER PRIMARY KEY,
  copy_id     INTEGER NOT NULL REFERENCES lib_copies (id),
  member_id   INTEGER NOT NULL REFERENCES lib_members (id),
  borrowed_on DATE NOT NULL,
  due_on      DATE NOT NULL,
  returned_on DATE,
  CHECK (due_on >= borrowed_on)
);
```

`returned_on` may be `NULL`, and here that has a real meaning: the copy is still out.

## Step 4: let the database enforce the rule

"A copy can only be with one member at a time" is the rule that matters most, so it should not depend on application code being correct. A partial unique index makes the rule part of the schema: at most one row per copy where `returned_on` is `NULL`.

```sql
CREATE UNIQUE INDEX one_open_loan_per_copy
  ON lib_loans (copy_id)
  WHERE returned_on IS NULL;

CREATE INDEX lib_loans_member_idx ON lib_loans (member_id);
```

Two people clicking Borrow at the same moment now cannot both succeed. One of them gets a constraint error, and the application can turn it into a friendly message. This is the idea from the transactions lesson, carried out by the schema.

## Step 5: test it with data

```sql
INSERT INTO lib_titles VALUES (1, 'Graphs at Work'), (2, 'Tides and Tables');
INSERT INTO lib_copies VALUES (1, 1, 'A-1'), (2, 1, 'A-2'), (3, 2, 'B-1');
INSERT INTO lib_members VALUES (1, 'Asha', 'asha@college.test'), (2, 'Ravi', 'ravi@college.test');
INSERT INTO lib_loans VALUES
  (1, 1, 1, '2026-01-01', '2026-01-15', '2026-01-10'),
  (2, 1, 2, '2026-02-01', '2026-02-15', NULL),
  (3, 3, 1, '2026-03-01', '2026-03-15', NULL);
```

## Step 6: answer the questions

Who has what, and what is overdue as of a given day?

```sql
SELECT m.name, t.title, l.due_on < DATE '2026-03-01' AS overdue
FROM lib_loans l
JOIN lib_members m ON m.id = l.member_id
JOIN lib_copies c ON c.id = l.copy_id
JOIN lib_titles t ON t.id = c.title_id
WHERE l.returned_on IS NULL
ORDER BY m.name;
```

| name | title | overdue |
|---|---|---|
| Asha | Tides and Tables | false |
| Ravi | Graphs at Work | true |

Which titles are most popular?

```sql
SELECT t.title, COUNT(l.id) AS loans
FROM lib_titles t
JOIN lib_copies c ON c.title_id = t.id
LEFT JOIN lib_loans l ON l.copy_id = c.id
GROUP BY t.id, t.title
ORDER BY loans DESC, t.title;
```

| title | loans |
|---|---|
| Graphs at Work | 2 |
| Tides and Tables | 1 |

How many copies of each title are on the shelf right now?

```sql
SELECT t.title, COUNT(c.id) AS available
FROM lib_titles t
JOIN lib_copies c ON c.title_id = t.id
LEFT JOIN lib_loans l ON l.copy_id = c.id AND l.returned_on IS NULL
WHERE l.id IS NULL
GROUP BY t.id, t.title
ORDER BY t.title;
```

| title | available |
|---|---|
| Graphs at Work | 1 |

Notice that the "still out" test sits in the `ON` clause. Placing it in `WHERE` would throw away the very rows the `LEFT JOIN` kept, and that is a mistake worth remembering.

> [!tip] Questions drive the design
> The test of a schema is whether the real questions are easy to ask. If a basic question needs a contorted query, the design is telling you something.

## Your turn

Extend the design without looking anything up. Decide the columns, keys and constraints for each.

- Members can reserve a title when no copy is free, and reservations are served in order.
- Late returns incur a fine, which can be paid in parts.
- The library needs to stop lending to anyone with unpaid fines. Which query would check this, and where would you run it?

There is no single right answer. Sketch it, and for each table ask what the key is, what each column depends on, and which rule the database itself could enforce.

## Summary

- Start from nouns and relationships, and look for one word hiding two things.
- Put your most important rules into the schema, where no bug can skip them.
- Judge a design by whether real questions are easy to ask.

:::quiz db-design-a-schema
