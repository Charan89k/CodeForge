import type { CourseSource } from "../index";
import { choice } from "../quiz";

export const PROGRAMMING_FOUNDATIONS: CourseSource = {
  slug: "programming-foundations",
  quizPrefix: "pf",
  title: "Programming Foundations",
  subtitle: "Learn to think in steps, and write Python that does what you meant",
  description:
    "For people who have never programmed, or who copied code without quite trusting it. You will solve each problem by hand first, trace what the machine really does, and build up from variables to functions, debugging and a first feel for how code scales. Every example in the course is run automatically, so the outputs you read are the real ones.",
  category: "Programming",
  level: "BEGINNER",
  outcomes: [
    "Turn a problem described in words into steps, then into working Python",
    "Predict what a short program prints by tracing it on paper",
    "Use conditions, loops, lists, dictionaries and functions with confidence",
    "Find bugs by method rather than by guessing",
    "Tell when code will become too slow as its input grows",
  ],
  prerequisites: ["No programming experience needed", "Basic arithmetic"],
  sections: [
    {
      slug: "thinking-in-steps",
      title: "Thinking in steps",
      summary: "What a program really is, and the values it works with.",
      lessons: [
        {
          slug: "programs-as-steps",
          title: "Programs as steps",
          summary:
            "A computer runs one line at a time. Learn to solve problems by hand first and trace code on paper.",
          difficulty: "EASY",
          objectives: [
            "Explain how a program runs line by line",
            "Work out inputs, outputs and hand steps before coding",
            "Trace a short program on paper",
          ],
          keyTakeaways: [
            "Nothing happens unless a line makes it happen",
            "Solve one small example by hand before writing code",
            "Tracing shows you what code really does",
          ],
          questions: [
            choice(
              "What does this print?",
              "6 3",
              ["3 6", "6 6", "It stops with an error"],
              "Line three changes a to 6, but b was given its value earlier and is not reconnected to a.",
              "a = 3\nb = a\na = a * 2\nprint(a, b)"
            ),
            choice(
              "A shop gives free delivery on orders of 500 or more. Before coding, which is the most useful step?",
              "Work out by hand what should happen for orders of, say, 499 and 500",
              [
                "Choose the variable names",
                "Install a faster computer",
                "Write the program and see what happens",
              ],
              "Working one small example by hand tells you the input, the output and the decision before any code exists."
            ),
            choice(
              "A program moves print(total) above the line that sets total. What happens?",
              "It stops with an error, because total does not exist yet at that line",
              [
                "It prints total anyway, since Python reads the whole file first",
                "It prints 0",
                "It runs that line last",
              ],
              "Lines run in order. When that print runs, nothing has created the name total."
            ),
          ],
        },
        {
          slug: "variables-and-types",
          title: "Variables and types",
          summary:
            "Names attach to values, and a value's type decides what you can do with it.",
          difficulty: "EASY",
          objectives: [
            "Read an assignment as work out the right, then name it",
            "Recognise int, float, str and bool",
            "Convert between types on purpose",
          ],
          keyTakeaways: [
            "= is not equality; it attaches a name to a result",
            "Quotes make text, even if it looks like a number",
            "Use // and % for whole-number division and remainders",
          ],
          questions: [
            choice(
              "What does this print?",
              "23",
              ["5", "It stops with an error", "2 3"],
              "Both values are text, so + joins them instead of adding.",
              'print("2" + "3")'
            ),
            choice(
              "What is 7 // 2 in Python?",
              "3",
              ["3.5", "4", "1"],
              "// is whole-number division. 7 / 2 would give 3.5, and 7 % 2 would give the remainder, 1."
            ),
            choice(
              "Why is money usually stored in whole paise rather than as a float of rupees?",
              "Floats cannot represent many decimal fractions exactly, so small errors build up",
              [
                "Whole numbers use less memory",
                "Python has no way to print decimals",
                "Floats cannot be added together",
              ],
              "0.1 + 0.2 is not exactly 0.3 in binary floating point. Whole numbers avoid that entirely."
            ),
          ],
        },
        {
          slug: "working-with-text",
          title: "Working with text",
          summary:
            "Index, slice, clean and format strings, the form most real data arrives in.",
          difficulty: "EASY",
          objectives: [
            "Index and slice a string without off-by-one errors",
            "Clean up text with strip, lower and split",
            "Build readable output with f-strings",
          ],
          keyTakeaways: [
            "Indexes start at zero",
            "A slice includes its start and excludes its stop",
            "String methods return new strings",
          ],
          questions: [
            choice(
              "What does this print?",
              "yth",
              ["pyt", "ytho", "yt"],
              "The slice starts at index 1 and stops before index 4, so it covers positions 1, 2 and 3.",
              'word = "python"\nprint(word[1:4])'
            ),
            choice(
              "What does this print?",
              "Hi",
              ["hi", "HI", "It stops with an error"],
              "lower() returns a new string, and nothing kept it. Strings never change in place.",
              'greeting = "Hi"\ngreeting.lower()\nprint(greeting)'
            ),
            choice(
              "A word has length 6. What is its last valid index?",
              "5",
              ["6", "7", "-6"],
              "Counting from zero, the positions run 0 to 5. Asking for index 6 raises an IndexError."
            ),
          ],
        },
      ],
    },
    {
      slug: "decisions-and-repetition",
      title: "Decisions and repetition",
      summary: "Make programs choose, repeat, and keep track of collections.",
      lessons: [
        {
          slug: "making-decisions",
          title: "Making decisions",
          summary:
            "Use if, elif and else, combine conditions, and test the edges where bugs live.",
          difficulty: "EASY",
          objectives: [
            "Write branches with if, elif and else",
            "Combine conditions with and, or and not",
            "Choose test values around a boundary",
          ],
          keyTakeaways: [
            "Indentation defines the block",
            "elif runs only the first true branch, so order matters",
            "Test on and either side of a boundary",
          ],
          questions: [
            choice(
              "What does this print?",
              "C",
              ["A", "B", "Nothing"],
              "The first branch checks marks >= 40, and 95 satisfies it, so the others are never reached. The most specific check must come first.",
              'marks = 95\nif marks >= 40:\n    print("C")\nelif marks >= 90:\n    print("A")\nelse:\n    print("B")'
            ),
            choice(
              "A rule says 'orders of 500 or more'. Which test values are most useful?",
              "499, 500 and 501",
              ["100, 200 and 300", "500 only", "1000 and 2000"],
              "Bugs gather at boundaries. These three catch a > that should have been >=."
            ),
            choice(
              "Why is n != 0 and 10 / n > 1 safe when n is 0?",
              "and stops at the first false side, so the division never runs",
              [
                "Python treats 10 / 0 as 0",
                "It is not safe, it raises an error",
                "and always evaluates the right side first",
              ],
              "This is short-circuiting. Once the left side is false, the whole expression must be false."
            ),
          ],
        },
        {
          slug: "repeating-work",
          title: "Repeating work with loops",
          summary:
            "Use for and while, build answers with accumulators, and avoid the loop that never ends.",
          difficulty: "EASY",
          objectives: [
            "Choose between for and while",
            "Use the accumulator pattern",
            "Leave a loop early with break",
          ],
          keyTakeaways: [
            "Start the accumulator outside the loop",
            "A while loop must change what its condition depends on",
            "Nested loops multiply the work",
          ],
          questions: [
            choice(
              "What does this print?",
              "6",
              ["3", "0", "10"],
              "total goes 0, 0, 1, 3, 6: range(4) gives 0, 1, 2 and 3.",
              "total = 0\nfor i in range(4):\n    total += i\nprint(total)"
            ),
            choice(
              "A program seems frozen in a while loop. What should you check first?",
              "Whether anything in the block moves the condition towards false",
              [
                "Whether the computer is too slow",
                "Whether the loop needs more indentation",
                "Whether while should be spelled differently",
              ],
              "A condition that never changes means the loop never ends."
            ),
            choice(
              "How many times does the inner print run?",
              "6",
              ["5", "3", "2"],
              "The inner loop runs fully for each outer pass: 3 times 2.",
              'for a in range(3):\n    for b in range(2):\n        print("x")'
            ),
          ],
        },
        {
          slug: "lists-and-dictionaries",
          title: "Lists and dictionaries",
          summary:
            "Keep items in order, look values up by key, and count things with a dictionary.",
          difficulty: "EASY",
          objectives: [
            "Change and copy lists safely",
            "Use dictionaries for lookups and counting",
            "Choose between a list, dictionary and set",
          ],
          keyTakeaways: [
            "Assignment shares a list; use copy() for an independent one",
            "Dictionary lookup does not slow down as it grows",
            "Counting with get(key, 0) solves many problems",
          ],
          questions: [
            choice(
              "What does this print?",
              "[1, 2, 3]",
              ["[1, 2]", "[3]", "It stops with an error"],
              "b is another name for the same list, not a copy, so the change shows through a.",
              "a = [1, 2]\nb = a\nb.append(3)\nprint(a)"
            ),
            choice(
              "You need to find a student's marks by roll number, thousands of times. What fits best?",
              "A dictionary from roll number to marks",
              [
                "A list of marks, walked each time",
                "One long string",
                "A separate variable per student",
              ],
              "A dictionary goes straight to the value, whereas walking a list gets slower as the list grows."
            ),
            choice(
              'What does stock.get("glue", 0) do when "glue" is not a key?',
              "Returns 0",
              [
                "Raises a KeyError",
                "Adds glue to the dictionary",
                "Returns the last value",
              ],
              "get returns its default when the key is missing and changes nothing. Square brackets would raise a KeyError."
            ),
          ],
        },
      ],
    },
    {
      slug: "building-with-functions",
      title: "Building with functions",
      summary: "Organise code, fix what breaks, and reason about its cost.",
      lessons: [
        {
          slug: "functions",
          title: "Functions",
          summary:
            "Name a piece of work, return results, and split programs into parts you can test.",
          difficulty: "EASY",
          objectives: [
            "Define and call functions with arguments and defaults",
            "Tell return from print",
            "Check a function with assert",
          ],
          keyTakeaways: [
            "return gives a value to the program; print shows it to a person",
            "Variables inside a function stay inside",
            "Small named functions can be tested alone",
          ],
          questions: [
            choice(
              "What does this print?",
              "None",
              ["4", "2", "It stops with an error"],
              "double works out a value and throws it away. With no return, the call gives back None.",
              "def double(n):\n    n * 2\n\nprint(double(2))"
            ),
            choice(
              "Why can a function with no return be a problem when used in further code?",
              "It gives back None, so there is no result to use",
              ["Python refuses to run it", "It deletes its arguments", "It runs twice"],
              "A function that only prints shows a person the answer but gives the program nothing."
            ),
            choice(
              'A function needs "and" to describe what it does. What might that suggest?',
              "It may be doing two jobs, and could be split",
              [
                "It should be renamed to include the word and",
                "It needs more arguments",
                "It should use a while loop",
              ],
              "A function that does one thing is easier to name, test and reuse."
            ),
          ],
        },
        {
          slug: "finding-and-fixing-bugs",
          title: "Finding and fixing bugs",
          summary:
            "Read tracebacks, narrow down wrong answers by method, and handle expected failures.",
          difficulty: "MEDIUM",
          objectives: [
            "Read a traceback from the bottom",
            "Debug by comparing expected and actual values",
            "Handle expected failures with try and except",
          ],
          keyTakeaways: [
            "The line that crashed is often not the line that is wrong",
            "Find the first step where expectation and reality differ",
            "Add a check for every bug you fix",
          ],
          questions: [
            choice(
              "When a traceback appears, where is the best place to start reading?",
              "The last line, which names the error",
              ["The first line", "The middle", "Skip it and re-run the program"],
              "The bottom says what went wrong, and the lines above show how the program got there."
            ),
            choice(
              "What does this print, and what is the bug?",
              "3, because total is overwritten rather than added to",
              [
                "6, there is no bug",
                "1, because the loop stops early",
                "0, because total is never used",
              ],
              "total = n replaces the value each pass. It should be total += n.",
              "total = 0\nfor n in [1, 2, 3]:\n    total = n\nprint(total)"
            ),
            choice(
              "Why is a bare except: usually a bad idea?",
              "It also hides bugs you need to see, such as typos",
              [
                "It is a syntax error",
                "It makes the program slower",
                "It only catches one kind of error",
              ],
              "Catch only the specific error you expect, so that real mistakes still surface."
            ),
          ],
        },
        {
          slug: "how-code-scales",
          title: "How code scales",
          summary:
            "Describe how work grows with input, spot nested loops and hidden loops, and trade memory for speed.",
          difficulty: "MEDIUM",
          objectives: [
            "Describe code as O(1), O(log n), O(n) or O(n²)",
            "Spot nested and hidden loops",
            "Use a set to bring a quadratic search down to linear",
          ],
          keyTakeaways: [
            "Complexity is about growth, not stopwatch time",
            "x in list is a hidden loop; x in set is not",
            "Trading memory for speed is a common move",
          ],
          questions: [
            choice(
              "An O(n²) function takes 1 second on 1,000 items. Roughly how long on 2,000?",
              "4 seconds",
              ["2 seconds", "1 second", "1,000 seconds"],
              "Doubling the input quadruples quadratic work."
            ),
            choice(
              "What is the time complexity, in the worst case, of this function?",
              "O(n²), because in on a list walks the list on every pass",
              ["O(n)", "O(1)", "O(log n)"],
              "One visible loop, plus a hidden one in the membership check. Making seen a set brings it to O(n).",
              "def unique(items):\n    seen = []\n    for x in items:\n        if x not in seen:\n            seen.append(x)\n    return seen"
            ),
            choice(
              "How does a set make the pair-sum search faster?",
              "Checking whether the needed partner was seen takes about the same time at any size",
              [
                "Sets sort the numbers automatically",
                "Sets use less memory than lists",
                "Sets remove all the duplicates, which is what took the time",
              ],
              "One pass with constant-time checks makes it O(n), at the cost of the memory for the set."
            ),
          ],
        },
      ],
    },
  ],
};
