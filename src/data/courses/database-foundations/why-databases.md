## The problem with a spreadsheet

Picture a small bookshop tracking orders in a spreadsheet. It works until it does not. Two staff edit at once and one overwrites the other. A customer's phone number is typed into forty rows and changes in thirty-nine. Someone sorts one column and not the others, and every order now belongs to the wrong person. A file with no rules accepts anything.

A database exists to take these failures away. It is a program whose whole job is to store data, keep it correct and answer questions about it, for many users at once, even if the power fails halfway through a write.

## What a relational database gives you

Relational databases such as PostgreSQL, MySQL and SQLite store data in tables, and they offer four things a pile of files does not.

| Promise | What it means for the bookshop |
|---|---|
| Structure | A price must be a number, and every order must belong to a real customer |
| Queries | Ask "best-selling book this month" without writing a program to walk the data |
| Concurrency | Two staff can sell at the same moment without corrupting anything |
| Durability | Once a sale is confirmed, a crash does not lose it |

## You say what, not how

In most programming, you describe the steps. In SQL, you describe the result, and the database works out how to get it.

```sql
SELECT 2 + 2 AS answer
```

| answer |
|---|
| 4 |

A real query reads almost like the question you would ask a colleague: `SELECT title FROM books WHERE price < 500`. You did not say which order to read rows in or whether to use an index. The database's query planner decides, and it can choose a better plan next year, when the data has grown, with no change to your query.

> [!note] What about NoSQL?
> Document and key-value stores make different trade-offs, often giving up joins or strict structure for flexibility or easier scaling. They suit some problems well. Relational databases remain the sensible default for most applications, and what you learn here carries across to the others.

## The words you will meet

- A **table** holds one kind of thing, such as books.
- A **row** is one of those things: one book.
- A **column** is one fact about it, such as the price, with a fixed type.
- A **schema** is the design of all the tables and the rules between them.
- A **query** is a question or an instruction, written in SQL.

## Try it

Think of an app you use every day, such as a food delivery app. Write down three things it must store and one fact about each. Then write one question the business would ask, such as "which restaurants had no orders this week?". You have just started designing a schema, and that is the next lesson.

## Summary

- A database enforces rules that a file cannot, and it stays correct with many users and through crashes.
- Relational databases organise data into tables of rows and columns.
- SQL says what you want, and the database decides how to get it.

:::quiz db-why-databases
