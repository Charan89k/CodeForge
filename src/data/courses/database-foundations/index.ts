import type { CourseSource } from "../index";
import { choice } from "../quiz";

export const DATABASE_FOUNDATIONS: CourseSource = {
  slug: "database-foundations",
  quizPrefix: "db",
  title: "Database Foundations",
  subtitle: "Model data properly, ask it anything in SQL, and keep it correct",
  description:
    "Build one small bookshop database from the first table to a working design. You will model data so facts live in one place, write queries with joins and grouping, and learn why indexes make reads fast and transactions keep money and stock correct. Every query in the course is run against PostgreSQL automatically, so the results shown are the real ones.",
  category: "Databases",
  level: "BEGINNER",
  outcomes: [
    "Design tables with keys and constraints that keep data correct",
    "Spot repeated facts and normalise them away",
    "Write SQL with joins, grouping, HAVING and subqueries",
    "Choose indexes and read a query plan",
    "Use transactions and guarded updates to stay correct under concurrency",
  ],
  prerequisites: ["Comfortable with variables, conditions and loops in any language"],
  sections: [
    {
      slug: "modelling-data",
      title: "Modelling data",
      summary: "Decide what to store, and let the database enforce the rules.",
      lessons: [
        {
          slug: "why-databases",
          title: "Why databases exist",
          summary:
            "What a database does that a spreadsheet cannot, and how relational systems think about data.",
          difficulty: "EASY",
          objectives: [
            "Explain what a database guarantees beyond a file",
            "Use the words table, row, column, schema and query",
            "Describe what it means for SQL to say what, not how",
          ],
          keyTakeaways: [
            "A database enforces rules a file cannot",
            "It stays correct with many users and through crashes",
            "You describe the result; the planner chooses how",
          ],
          questions: [
            choice(
              "Two staff edit a shared spreadsheet at once and one overwrites the other. Which database promise addresses this?",
              "Concurrency",
              ["Durability", "Structure", "Normalisation"],
              "Databases are built to handle many simultaneous users without one silently destroying the other's work."
            ),
            choice(
              "What does it mean that SQL is declarative?",
              "You describe the result you want, and the database chooses how to get it",
              [
                "You must declare every variable first",
                "You list the exact steps to read the data",
                "Queries can only read data, never change it",
              ],
              "The query planner picks the method, and it can pick a better one as the data grows without any change to your query."
            ),
            choice(
              "In a table of books, what is one row?",
              "One book",
              [
                "One fact about all books",
                "The design of the table",
                "One type of data",
              ],
              "A table holds one kind of thing, a row is one of those things, and a column is one fact about it."
            ),
          ],
        },
        {
          slug: "tables-and-keys",
          title: "Tables and keys",
          summary:
            "Turn nouns into tables, identify rows with primary keys, and link them with foreign keys.",
          difficulty: "EASY",
          objectives: [
            "Write CREATE TABLE with types and constraints",
            "Choose primary keys and foreign keys",
            "Model one-to-many and many-to-many relationships",
          ],
          keyTakeaways: [
            "Use a meaningless id as the primary key",
            "Foreign keys stop links pointing at nothing",
            "Many-to-many needs a joining table",
          ],
          questions: [
            choice(
              "Why is a person's name a poor primary key?",
              "Names can repeat and can change",
              [
                "Names are too long to store",
                "Text cannot be a key",
                "Names are always NULL",
              ],
              "A key must be unique and stable, so a meaningless id is the safer choice."
            ),
            choice(
              "An order can contain many books, and a book can be on many orders. How do you store this?",
              "A third table with one row for each order and book pair",
              [
                "A column on orders listing the book ids",
                "A foreign key on books pointing to orders",
                "Copy the order into the books table",
              ],
              "A single column cannot hold several books properly. The joining table also holds facts about the pair, such as quantity."
            ),
            choice(
              "What happens when you insert a book whose author_id matches no author, given a foreign key?",
              "The database refuses it with an error",
              [
                "It creates the author automatically",
                "It stores NULL instead",
                "It accepts it and warns later",
              ],
              "This is the point of a foreign key: a bad link becomes an immediate error rather than a silent mistake."
            ),
          ],
        },
        {
          slug: "designing-without-repetition",
          title: "Designing without repetition",
          summary:
            "Why repeated facts cause trouble, how normalisation removes them, and when a copy is correct.",
          difficulty: "MEDIUM",
          objectives: [
            "Recognise update, insert and delete problems",
            "Apply first, second and third normal form in practice",
            "Decide when storing a copy is the right design",
          ],
          keyTakeaways: [
            "Each fact should live in exactly one place",
            "Every column should depend on the key alone",
            "A copy is right when it records a moment in time",
          ],
          questions: [
            choice(
              "A customer's city is stored on every one of their order rows. They move. What is the risk?",
              "Some rows get missed, and the data then disagrees with itself",
              [
                "The database will run out of space",
                "The orders are deleted",
                "Nothing, since the rows update themselves",
              ],
              "This is an update anomaly. Keeping the city once, on the customer, removes it."
            ),
            choice(
              "Should an order line store the price paid, even though books already have a price?",
              "Yes, because the price paid is a different fact and must not change later",
              [
                "No, that is always repetition",
                "No, join to books and use today's price",
                "Only if the price is over 1,000",
              ],
              "Today's price and the price charged on the day are separate facts. An old invoice must stay as it was."
            ),
            choice(
              "In a table keyed by (order_id, book_id), where does the book's title belong?",
              "In the books table, because it depends only on book_id",
              [
                "Here, next to the key",
                "In the orders table",
                "In a new column for each order",
              ],
              "Second normal form: a fact must depend on the whole key, and the title depends on only part of it."
            ),
          ],
        },
      ],
    },
    {
      slug: "asking-questions-in-sql",
      title: "Asking questions in SQL",
      summary: "Filter, join and summarise until the data answers you.",
      lessons: [
        {
          slug: "asking-questions",
          title: "Asking questions with SELECT",
          summary:
            "Choose rows and columns, handle NULL properly, and change data without disasters.",
          difficulty: "EASY",
          objectives: [
            "Filter and sort with WHERE and ORDER BY",
            "Test for NULL correctly",
            "Change rows safely with UPDATE and DELETE",
          ],
          keyTakeaways: [
            "No ORDER BY means no guaranteed order",
            "NULL means unknown; use IS NULL",
            "Check your WHERE with a SELECT first",
          ],
          questions: [
            choice(
              "How many rows does this return from a table where some author_id values are missing?",
              "None, because comparing with NULL is never true",
              [
                "All the rows with a missing author",
                "Every row in the table",
                "It raises an error",
              ],
              "Use IS NULL. The = NULL form runs quietly and returns nothing, which makes it an easy bug to miss.",
              "SELECT * FROM books WHERE author_id = NULL;"
            ),
            choice(
              "What happens with UPDATE books SET price = 0, with no WHERE?",
              "Every book's price becomes 0",
              [
                "It raises an error",
                "Only the first book changes",
                "Nothing, it needs a WHERE",
              ],
              "With no WHERE, an update applies to every row. Run a SELECT with your condition first."
            ),
            choice(
              "Without ORDER BY, what order do rows come back in?",
              "Any order, which can change between runs",
              ["Primary key order", "Insertion order", "Alphabetical order"],
              "Only ORDER BY guarantees an order, even if a table seems to come back sorted today."
            ),
          ],
        },
        {
          slug: "joins",
          title: "Joins",
          summary:
            "Bring split tables back together, keep unmatched rows, and avoid multiplying your totals.",
          difficulty: "MEDIUM",
          objectives: [
            "Choose between JOIN and LEFT JOIN",
            "Find rows with no match",
            "Join across several tables",
          ],
          keyTakeaways: [
            "JOIN keeps only rows that match on both sides",
            "LEFT JOIN with IS NULL finds what has no match",
            "Know what one row of the result represents",
          ],
          questions: [
            choice(
              "Which query finds customers who have never placed an order?",
              "LEFT JOIN orders, then WHERE the order's id IS NULL",
              [
                "JOIN orders, then WHERE the order's id IS NULL",
                "SELECT from orders where the customer is missing",
                "JOIN orders with no ON clause",
              ],
              "An inner join drops those customers altogether. A left join keeps them, with NULLs on the orders side."
            ),
            choice(
              "An author with no books does not appear in a report that uses JOIN. Why?",
              "An inner join keeps only rows with a match on both sides",
              [
                "The author has been deleted",
                "NULL values always sort last",
                "JOIN only returns the first match",
              ],
              "Use LEFT JOIN when a row should stay even with no partner."
            ),
            choice(
              "Joining 2 customers to their 4 order lines gives 4 rows, and COUNT(*) says 4. How do you count customers?",
              "COUNT(DISTINCT customer id)",
              ["COUNT(*) divided by 2", "SUM(customer id)", "MAX(customer id)"],
              "Joins multiply rows, so count the distinct thing you care about."
            ),
          ],
        },
        {
          slug: "summarising-data",
          title: "Summarising data",
          summary:
            "Aggregate with GROUP BY, filter groups with HAVING, and nest one question in another.",
          difficulty: "MEDIUM",
          objectives: [
            "Use COUNT, SUM, MIN, MAX and AVG",
            "Group rows and filter groups",
            "Write a simple subquery",
          ],
          keyTakeaways: [
            "One result row per group",
            "WHERE filters rows; HAVING filters groups",
            "LEFT JOIN with COALESCE keeps empty groups",
          ],
          questions: [
            choice(
              "Which clause keeps only customers with more than one order?",
              "HAVING COUNT(*) > 1",
              ["WHERE COUNT(*) > 1", "ORDER BY COUNT(*)", "LIMIT 1"],
              "WHERE runs before grouping, so totals do not exist yet at that point."
            ),
            choice(
              "A table has 5 rows, and one has a NULL author_id. What is COUNT(author_id)?",
              "4",
              ["5", "NULL", "1"],
              "COUNT(*) counts rows, while COUNT(column) skips NULLs."
            ),
            choice(
              "Why does this fail?",
              "name is neither grouped nor inside an aggregate",
              [
                "COUNT needs a column name",
                "GROUP BY must come before FROM",
                "city cannot be grouped",
              ],
              "With several names in each city, the database cannot know which one to show.",
              "SELECT city, name, COUNT(*) FROM customers GROUP BY city;"
            ),
          ],
        },
      ],
    },
    {
      slug: "fast-and-correct",
      title: "Fast and correct",
      summary: "Keep it quick as it grows, and right when everyone arrives at once.",
      lessons: [
        {
          slug: "indexes",
          title: "Indexes",
          summary:
            "How a sorted lookup speeds up reads, what it costs, and how to see what the database did.",
          difficulty: "MEDIUM",
          objectives: [
            "Explain what an index does and what it costs",
            "Choose column order in a composite index",
            "Read a query plan with EXPLAIN",
          ],
          keyTakeaways: [
            "Indexes trade storage and write speed for faster reads",
            "Column order decides which queries a composite index helps",
            "Measure with EXPLAIN rather than guessing",
          ],
          questions: [
            choice(
              "Which query can an index on (customer_id, placed_on) help least?",
              "WHERE placed_on > '2026-01-01' on its own",
              [
                "WHERE customer_id = 1",
                "WHERE customer_id = 1 AND placed_on > '2026-01-01'",
                "WHERE customer_id = 1 ORDER BY placed_on",
              ],
              "Like a phone book sorted by surname, it cannot find everybody with a given first name."
            ),
            choice(
              "Why not simply index every column?",
              "Each index takes space and must be updated on writes",
              [
                "PostgreSQL allows only one index per table",
                "Indexes make reads slower",
                "Indexes delete old rows",
              ],
              "Index the columns that real queries filter, join and sort on."
            ),
            choice(
              "Why can't a plain index on title help with LIKE '%Work'?",
              "A leading wildcard gives no starting point in the sorted order",
              [
                "LIKE never uses indexes",
                "Text columns cannot be indexed",
                "The pattern is too short",
              ],
              "LIKE 'Graphs%' knows where to start. LIKE '%Work' would have to look at every entry."
            ),
          ],
        },
        {
          slug: "transactions",
          title: "Transactions and concurrency",
          summary:
            "Make several writes succeed or fail as one, and stop two people selling the last copy.",
          difficulty: "HARD",
          objectives: [
            "Use BEGIN, COMMIT and ROLLBACK",
            "Explain the ACID guarantees",
            "Prevent a race with a guarded update",
          ],
          keyTakeaways: [
            "All of it or none of it",
            "Constraints hold even when the application has bugs",
            "Check and change in a single statement",
          ],
          questions: [
            choice(
              "The server crashes between two statements in a transaction with no COMMIT yet. What happens?",
              "Neither statement's change survives",
              [
                "The first statement's change is kept",
                "Both changes are kept",
                "The table is locked forever",
              ],
              "That is atomicity: without a commit, the work is as if it never happened."
            ),
            choice(
              "Two staff both read stock as 1 and then both sell the last copy. Which change prevents it?",
              "UPDATE stock SET copies = copies - 1 WHERE book_id = 3 AND copies > 0",
              [
                "Reading the stock twice before selling",
                "Adding ORDER BY to the read",
                "Running the application on a faster server",
              ],
              "The database does the check and the change as one step, so the second update matches no row, and the application sees that nothing changed."
            ),
            choice(
              "Why should a transaction not wait for a slow network call?",
              "It holds its locks all that time, blocking anyone who needs those rows",
              [
                "Transactions expire after one second",
                "Network calls cannot run in SQL",
                "It would commit twice",
              ],
              "Keep transactions short, and do slow work before or after them."
            ),
          ],
        },
        {
          slug: "design-a-schema",
          title: "Project: design a schema",
          summary:
            "Take a college library from a description to tables, enforced rules and working queries.",
          difficulty: "HARD",
          objectives: [
            "Derive a schema from a description",
            "Enforce an important rule in the schema itself",
            "Test a design with real questions",
          ],
          keyTakeaways: [
            "Look for one word hiding two things",
            "Put your most important rules where no bug can skip them",
            "Good designs make real questions easy",
          ],
          questions: [
            choice(
              "Why separate titles from copies in a library?",
              "A member borrows one physical copy, while a title may have many of them",
              [
                "Titles take up too much storage",
                "It makes the queries shorter",
                "SQL requires at least two tables",
              ],
              "The word book hides two different things, and they have different facts and different relationships."
            ),
            choice(
              "What does a partial unique index on (copy_id) WHERE returned_on IS NULL guarantee?",
              "A copy can have at most one open loan at a time",
              [
                "A copy can only ever be borrowed once",
                "Every loan must be returned",
                "A member can have only one loan",
              ],
              "It enforces the rule in the schema, so even two simultaneous requests cannot both succeed."
            ),
            choice(
              "With LEFT JOIN loans, why does the 'still out' test go in ON rather than WHERE?",
              "In WHERE it would discard the rows with no open loan, which are what you want to count",
              [
                "WHERE cannot test for NULL",
                "ON always runs faster",
                "There is no difference",
              ],
              "ON decides what counts as a match, and unmatched rows are still kept. WHERE then removes rows from the result."
            ),
          ],
        },
      ],
    },
  ],
};
