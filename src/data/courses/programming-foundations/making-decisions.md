## A program chooses with if

Without decisions, a program does the same thing every time. `if` runs a block of code only when a condition is true. The indented lines are the block, and the indentation is not decoration: in Python, it is how the block is defined.

```python
marks = 72
if marks >= 40:
    print("Pass")
else:
    print("Fail")
print("Done")
```

```text
Pass
Done
```

`print("Done")` is not indented, so it runs either way.

## Comparisons produce true or false

`==` asks whether two values are equal, while `=` assigns. The others are `!=`, `<`, `<=`, `>` and `>=`. Each produces a `bool`, which you can store like any other value.

```python
age = 17
can_vote = age >= 18
print(can_vote)
```

```text
False
```

## Several branches with elif

When there are more than two outcomes, `elif` adds branches. They are checked from the top, and only the first true one runs.

```python
marks = 85
if marks >= 90:
    grade = "A"
elif marks >= 75:
    grade = "B"
elif marks >= 40:
    grade = "C"
else:
    grade = "F"
print(grade)
```

```text
B
```

Order matters. 85 also satisfies `marks >= 40`, but that branch is never reached. Had the checks been written lowest first, every passing student would get a C.

> [!warning] The order trap
> With overlapping conditions in `elif`, put the most specific one first. If a branch can never run, Python will not warn you. Test your code with a value from each band to catch it.

## Combining conditions

`and` needs both sides true, `or` needs at least one, and `not` flips a value.

```python
age = 20
has_id = True
print(age >= 18 and has_id)
print(age < 13 or age > 60)
print(not has_id)
```

```text
True
False
False
```

Python also stops early. In `n != 0 and 10 / n > 1`, if `n` is 0 the left side is false, the right side is never run, and so the division cannot fail. This pattern, called short-circuiting, is a common way to guard risky work.

## Test the boundaries

Bugs gather at the edges. When a rule says "500 or more", the values to try are 499, 500 and 501, not 200 and 900. Testing just below, on, and just above a boundary catches the `>` that should have been `>=`.

## Worked example: leap years

A year is a leap year if it divides by 4, except century years, which must also divide by 400. By hand: 2024 yes, 1900 no (a century, not by 400), 2000 yes.

```python
for year in [2024, 1900, 2000, 2023]:
    leap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
    print(year, leap)
```

```text
2024 True
1900 False
2000 True
2023 False
```

The test values were not random. Each one exercises a different part of the rule.

## Try it

A parcel costs 40 rupees up to 1 kg, 70 up to 5 kg, and otherwise 120. Write it, then check 1, 1.5, 5 and 5.1.

```python
for weight in [1, 1.5, 5, 5.1]:
    if weight <= 1:
        cost = 40
    elif weight <= 5:
        cost = 70
    else:
        cost = 120
    print(weight, cost)
```

```text
1 40
1.5 70
5 70
5.1 120
```

## Summary

- Indentation defines which lines an `if` controls.
- `elif` checks in order and runs only the first true branch.
- Always test the values on and either side of a boundary.

:::quiz pf-making-decisions
