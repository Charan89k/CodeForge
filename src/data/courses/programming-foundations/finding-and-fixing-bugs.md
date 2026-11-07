## Every program has bugs at first

Writing code that fails is normal, and good programmers differ mainly in how quickly they find out why. Debugging is not guessing. It is forming a theory, checking it, and narrowing down where reality and your expectation part ways.

## Read the error from the bottom

When Python stops, it prints a traceback. The last line says what went wrong, and the lines above show where.

```text
Traceback (most recent call last):
  File "bill.py", line 4, in <module>
    print(total / count)
ZeroDivisionError: division by zero
```

Read it as: line 4 divided by something that was zero. Now ask why `count` was zero. The line that crashed is often not the line that is wrong.

| Error | Usually means |
|---|---|
| `SyntaxError` | The code is not valid Python: a missing colon or bracket |
| `NameError` | A name used before it was set, often a typo |
| `TypeError` | An operation on the wrong type, such as text plus a number |
| `IndexError` | A position past the end of a list |
| `KeyError` | A dictionary key that is not there |

## When there is no error at all

The harder bugs run happily and give a wrong answer. This function should average a list, but it does not.

```python
def average(values):
    total = 0
    for value in values:
        total = value
    return total / len(values)

print(average([2, 4, 6]))
```

```text
2.0
```

The right answer is 4. A systematic approach beats staring:

1. Reproduce it with the smallest input that fails.
2. Say what you expected at each step, not just at the end.
3. Look at what the program really has, by printing values or tracing on paper.
4. Find the first step where the two differ. The bug is there.

Tracing `total` for `[2, 4, 6]` gives 2, 4, 6. You expected 2, 6, 12. It differs on the second pass, which points straight at `total = value`, and it should be `total += value`.

```python
def average(values):
    total = 0
    for value in values:
        total += value
    return total / len(values)

print(average([2, 4, 6]))
```

```text
4.0
```

> [!tip] Change one thing at a time
> If you change three things and it starts working, you have not learned which one mattered, and you may have added a new bug. Change one, then run it.

## Expected failures: try and except

Some failures are not bugs. A user types letters where a number belongs, or a file is missing. `try` lets you handle those.

```python
def parse_age(text):
    try:
        return int(text)
    except ValueError:
        return None

print(parse_age("19"))
print(parse_age("nineteen"))
```

```text
19
None
```

Catch the specific error you expect. A bare `except:` also swallows your own typos, hiding exactly the bugs you need to see.

## Testing keeps bugs fixed

When you fix a bug, write a check that would have caught it. It stays with the code, so the same bug cannot quietly return. Include the awkward inputs too: an empty list, a single item, a negative number. Our `average` still fails on an empty list, and deciding what it should do then is a real design question.

```python
def average(values):
    if not values:
        return None
    return sum(values) / len(values)

assert average([2, 4, 6]) == 4
assert average([5]) == 5
assert average([]) is None
print("average is checked")
```

```text
average is checked
```

## Try it

This should count the vowels, but `count_vowels("Apple")` returns 1 instead of 2. Trace it and find out why before reading the fix.

```python
def count_vowels(text):
    count = 0
    for ch in text.lower():
        if ch in "aeiou":
            count += 1
    return count

print(count_vowels("Apple"))
```

```text
2
```

The buggy version looped over `text` without `.lower()`, so the capital `A` did not match.

## Summary

- Read tracebacks from the bottom, and remember the crash may be far from the cause.
- Compare what you expected with what happened, step by step, and fix the first difference.
- Catch only the errors you expect, and add a check for every bug you fix.

:::quiz pf-finding-and-fixing-bugs
