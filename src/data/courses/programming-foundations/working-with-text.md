## Text is a sequence of characters

Most real data arrives as text: names, messages, lines of a file. A string is an ordered sequence of characters, and each position has an index that starts from zero.

```python
word = "python"
print(word[0])
print(word[5])
print(word[-1])
print(len(word))
```

```text
p
n
n
6
```

A negative index counts from the end. `len()` gives the length, so the last valid position is always `len(word) - 1`. Asking for `word[6]` stops the program with an `IndexError`, and that off-by-one is among the most common mistakes in all of programming.

## Slicing takes a piece

`word[start:stop]` gives the characters from `start` up to but not including `stop`. Leaving out a side means "from the beginning" or "to the end".

```python
code = "CS101-A"
print(code[0:2])
print(code[2:5])
print(code[6:])
print(code[:5])
```

```text
CS
101
A
CS101
```

The stop being excluded is a deliberate choice: `code[0:2]` and `code[2:]` meet exactly, with nothing lost or repeated.

## Strings have useful methods

A method is an operation that belongs to a value, called with a dot. These are the ones you will use most.

```python
raw = "  Asha Rao  "
print(raw.strip())
print(raw.strip().lower())
print(raw.strip().split(" "))
print("-".join(["2026", "11", "03"]))
print("Rao" in raw)
```

```text
Asha Rao
asha rao
['Asha', 'Rao']
2026-11-03
True
```

Calls can be chained, because each one returns a new string for the next to work on.

> [!note] Strings never change
> `raw.lower()` leaves `raw` as it was and gives you a new string. If you want to keep the result, assign it: `raw = raw.lower()`. Forgetting this looks like the method did nothing.

## Build output with f-strings

Joining text with `+` needs `str()` everywhere. An f-string is easier to read: put `f` before the quote and any expression inside braces.

```python
name = "Asha"
marks = 87
total = 100
print(f"{name} scored {marks}/{total}, which is {marks / total:.1%}")
```

```text
Asha scored 87/100, which is 87.0%
```

## Worked example: cleaning a messy entry

A form gives you `"  ASHA.rao@Example.COM "`. Email addresses are compared case-insensitively here, so you want it trimmed and lowercased, and you want the part after the `@`.

```python
entry = "  ASHA.rao@Example.COM "
email = entry.strip().lower()
domain = email.split("@")[1]
print(email)
print(domain)
```

```text
asha.rao@example.com
example.com
```

This is the hand method again: trim it, lowercase it, split at the `@`, take the second piece.

## Try it

Given `"rollno:2041"`, print just the number as an `int`, plus one. Try it yourself first, then compare.

```python
field = "rollno:2041"
number = int(field.split(":")[1])
print(number + 1)
```

```text
2042
```

## Summary

- Indexes start at zero, and negative ones count from the end.
- A slice includes its start and excludes its stop.
- String methods return new strings, so keep the result if you need it.

:::quiz pf-working-with-text
