## What goes wrong when facts repeat

Suppose someone keeps all the orders in one wide table.

| order_id | customer | city | book | author | price |
|---|---|---|---|---|---|
| 1 | Asha | Mumbai | Graphs at Work | L. Sato | 750 |
| 1 | Asha | Mumbai | Practical SQL Notes | R. Menon | 450 |
| 2 | Ravi | Pune | Practical SQL Notes | R. Menon | 450 |

It looks convenient, but it invites three failures.

- **Update trouble.** Asha moves to Delhi. Every one of her rows must change. Miss one and the database now disagrees with itself.
- **Insert trouble.** A new book arrives. You cannot record it until somebody orders it, because every row is an order.
- **Delete trouble.** Ravi's order is cancelled, and deleting the row may also delete the only record of a customer.

All three share a cause: one fact is stored in several places, or several unrelated facts are stored in one row.

## Normalisation is removing that repetition

Normalisation means reorganising tables so that each fact lives in exactly one place. It is described as a series of normal forms. You rarely need the formal definitions, but the ideas behind the first three are worth knowing.

**First normal form: one value per cell.** A `books` column holding "Graphs at Work, Tides and Tables" cannot be searched or joined properly. Give each value its own row.

**Second normal form: facts depend on the whole key.** In a table keyed by `(order_id, book_id)`, the quantity depends on both. A book's title depends only on `book_id`, so it belongs in `books`.

**Third normal form: facts depend only on the key.** If `orders` held `customer_id` and also `customer_city`, the city would depend on the customer, not on the order. It belongs in `customers`.

The usual summary is that every column should describe the key, the whole key, and nothing but the key.

> [!insight] The test to apply
> For each column, ask: if this fact changed, how many rows would I have to update? If the answer is more than one, it probably belongs in another table.

## This is the schema you already built

Splitting that wide table gives the tables from the previous lesson. Asha's city now lives in one row of `customers`, so moving her is a single update, and a new book can exist before anyone buys it.

## When repeating a value is correct

Not every repetition is a mistake. Compare a book's current price with the price a customer paid. If the book's price rises next month, last year's invoice must not change. So an order line should keep its own copy of the price paid, because that is a different fact: what was charged, on that day.

This is a design decision rather than an exception to the rule. The copy never needs updating, because it records something that happened.

## Deliberate denormalisation

Sometimes teams store a computed value on purpose, such as a cached order total, because working it out is too slow for a busy page. That is denormalisation. It buys read speed and costs you the job of keeping the copy correct. Start normalised and add this only when you have measured a real problem.

## Try it

A college stores: `student_id, student_name, course_code, course_title, teacher_name, grade`. Sketch how you would split it before reading on.

- `students (id, name)`
- `courses (code, title, teacher_name)`
- `enrolments (student_id, course_code, grade)`, with both as the primary key

The grade depends on the student and the course together, so it lives on the joining table. If a teacher can teach several courses and you need facts about teachers, they would become a table of their own.

## Summary

- Repeated facts cause update, insert and delete problems.
- Each fact should live in one place, and each column should depend on the key alone.
- Storing a copy is fine when it records a moment in time, or when you have measured the need.

:::quiz db-designing-without-repetition
