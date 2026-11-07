## A variable is a name for a value

`score = 10` does not mean score equals 10 in the algebra sense. It means: work out the right side, then attach the name on the left to the result. That is why this line, which would be nonsense in algebra, is ordinary in a program.

```python
score = 10
score = score + 5
print(score)
```

```text
15
```

The right side is worked out first, using the old value. Then the name moves to the new one.

## Choose names that explain themselves

Python accepts `x`, but your next reader, often you a month from now, wants to know what `x` is. Compare `t = p * q` with `total = price * quantity`. They run identically, and only one explains itself. Use lowercase words joined by underscores, such as `items_left`.

## Every value has a type

A type says what a value is and what you can do with it. These four cover most beginner programs:

| Type | Holds | Example |
|---|---|---|
| `int` | whole numbers | `42` |
| `float` | numbers with a fractional part | `3.5` |
| `str` | text | `"hello"` |
| `bool` | true or false | `True` |

`type()` tells you which one you have.

```python
print(type(42).__name__)
print(type(3.5).__name__)
print(type("42").__name__)
print(type(42 > 1).__name__)
```

```text
int
float
str
bool
```

Look closely at the third line. `"42"` is text, not a number, even though it looks like one. The quotes decide.

## Type decides what an operator does

The same symbol can mean different things for different types. `+` adds numbers and joins text.

```python
print(2 + 3)
print("2" + "3")
```

```text
5
23
```

Mixing them fails, because Python will not guess which you wanted. Convert explicitly with `int()`, `float()` or `str()`.

```python
age_text = "19"
next_year = int(age_text) + 1
print("Next year: " + str(next_year))
```

```text
Next year: 20
```

> [!warning] Division gives a float
> `7 / 2` is `3.5`, and even `6 / 2` is `3.0`. Use `//` for whole-number division and `%` for the remainder: `7 // 2` is 3 and `7 % 2` is 1.

## A number is not always exact

Floats are stored in binary, and many decimal fractions have no exact binary form, so small errors appear.

```python
print(0.1 + 0.2)
print(0.1 + 0.2 == 0.3)
```

```text
0.30000000000000004
False
```

This is not a bug in Python; nearly every language behaves this way. Money is therefore usually counted in whole paise as an `int`, never as a fractional float.

## Try it

A bill is 1250 paise split between 4 people. Compute each person's share in whole paise and how many paise are left over.

```python
bill = 1250
people = 4
print(bill // people, bill % people)
```

```text
312 2
```

## Summary

- `=` works out the right side, then attaches the name on the left.
- A value's type decides what you can do with it, and quotes make text.
- Convert types on purpose, and count money in whole units.

:::quiz pf-variables-and-types
