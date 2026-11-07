## Lists hold items in order

A list is an ordered collection you can change. It uses the same indexing and slicing as strings, but unlike strings it can be modified in place.

```python
scores = [70, 85, 60]
scores.append(90)
scores[0] = 75
print(scores)
print(len(scores), sum(scores), max(scores))
print(sorted(scores))
print(scores)
```

```text
[75, 85, 60, 90]
4 310 90
[60, 75, 85, 90]
[75, 85, 60, 90]
```

`sorted()` returns a new list and leaves the original alone, as the last line shows. `scores.sort()` would change the list itself.

## Two names, one list

Assignment does not copy a list. It attaches a second name to the same one.

```python
a = [1, 2]
b = a
b.append(3)
print(a)
c = a.copy()
c.append(4)
print(a, c)
```

```text
[1, 2, 3]
[1, 2, 3] [1, 2, 3, 4]
```

This surprises nearly everyone once. If you need an independent list, ask for a copy.

## List comprehensions

Building one list from another is so common that it has a short form. Read it as "this expression, for each item, if this holds".

```python
marks = [35, 72, 90, 48]
passed = [m for m in marks if m >= 40]
curved = [m + 5 for m in marks]
print(passed)
print(curved)
```

```text
[72, 90, 48]
[40, 77, 95, 53]
```

## Dictionaries look things up by key

A dictionary maps keys to values. Instead of walking a list to find a roll number, you ask for it directly, and the lookup takes about the same time however large the dictionary grows.

```python
stock = {"pen": 12, "ruler": 3}
print(stock["pen"])
stock["eraser"] = 7
stock["ruler"] -= 1
print(stock)
print("glue" in stock)
print(stock.get("glue", 0))
```

```text
12
{'pen': 12, 'ruler': 2, 'eraser': 7}
False
0
```

Asking for a missing key with `stock["glue"]` raises a `KeyError`. `get` with a default is the safe way when absence is normal.

| You want | Use |
|---|---|
| Items in a sequence, by position | list |
| Values looked up by a name or id | dictionary |
| Only whether something has been seen | set |

## Counting with a dictionary

This pattern appears everywhere: count how often each thing occurs.

```python
words = "to be or not to be".split()
counts = {}
for word in words:
    counts[word] = counts.get(word, 0) + 1
print(counts)
```

```text
{'to': 2, 'be': 2, 'or': 1, 'not': 1}
```

## Sets remember what you have seen

A set holds unique items with no order, and membership checks are fast.

```python
seen = set()
duplicates = []
for roll in [101, 102, 101, 103, 102]:
    if roll in seen:
        duplicates.append(roll)
    seen.add(roll)
print(duplicates)
```

```text
[101, 102]
```

## Try it

Two words are rearrangements of each other if they use the same letters the same number of times. How would you check that using what you just saw? Build a count of each word and compare. Then try it, along with a related problem, on the judge.

:::problems rearrangement-check first-unrepeated-symbol

## Summary

- Lists keep order and can change; assignment shares them rather than copying.
- Dictionaries find values by key directly, without searching.
- Counting with a dictionary and remembering with a set solve a surprising number of problems.

:::quiz pf-lists-and-dictionaries
