## A function names a piece of work

A function packages steps under a name, so you can use them without rethinking them. `def` defines it, and calling it runs the body with the arguments you pass.

```python
def discounted(order):
    if order >= 500:
        return order - order // 10
    return order

print(discounted(600))
print(discounted(200))
```

```text
540
200
```

`return` hands a value back to the caller and ends the function at once. Defining a function runs nothing; only calling it does.

## return is not print

This is the most common beginner confusion. `print` shows something to a person. `return` gives a value to the program. A function with no `return` gives back `None`.

```python
def shows(n):
    print(n * 2)

def gives(n):
    return n * 2

a = shows(4)
b = gives(4)
print(a, b)
```

```text
8
None 8
```

If you want to use a result in further code, you need `return`. Prefer functions that return values and let the caller decide what to print.

## Names inside stay inside

A variable created in a function exists only while it runs. That is a feature: you can reason about a function by reading only the function.

```python
def add_tax(amount):
    tax = amount * 18 // 100
    return amount + tax

print(add_tax(100))
print("tax" in globals())
```

```text
118
False
```

A function can read outer variables, but relying on that hides what it depends on. Pass what it needs as arguments.

## Default values and keywords

A parameter can have a default, and callers can name arguments for clarity.

```python
def repeat(text, times=2, separator=" "):
    return separator.join([text] * times)

print(repeat("hi"))
print(repeat("hi", 3))
print(repeat("hi", separator="-", times=3))
```

```text
hi hi
hi hi hi
hi-hi-hi
```

> [!warning] Never use a list as a default
> `def add(item, items=[])` looks harmless, but the default list is created once and shared by every call, so items pile up between calls. Use `items=None`, then create the list inside the function.

## Why bother splitting code up

A good function does one thing, has a name that says what, and can be tested alone. Compare this version, where each step can be read and checked on its own, with one long block doing all three things.

```python
def clean(line):
    return line.strip().lower()

def is_valid_email(text):
    return "@" in text and "." in text.split("@")[-1]

def valid_emails(lines):
    cleaned = [clean(line) for line in lines]
    return [email for email in cleaned if is_valid_email(email)]

print(valid_emails(["  A@x.COM ", "nope", "b@y"]))
```

```text
['a@x.com']
```

A useful test: if you need "and" to describe what a function does, it may be two functions.

## Check your functions

An `assert` stops the program if a claim is false. A few asserts next to a function are the smallest useful test you can write, and they keep working as you change the code.

```python
def is_even(n):
    return n % 2 == 0

assert is_even(4)
assert not is_even(7)
assert is_even(0)
print("All checks passed")
```

```text
All checks passed
```

## Try it

Write `clamp(value, low, high)`, which returns `value` limited to the range. Check the three cases. Then take a problem on the judge, where your function is called for you and tested.

```python
def clamp(value, low, high):
    if value < low:
        return low
    if value > high:
        return high
    return value

assert clamp(5, 0, 10) == 5
assert clamp(-2, 0, 10) == 0
assert clamp(99, 0, 10) == 10
print("clamp works")
```

```text
clamp works
```

:::problems missing-ticket-number power-of-two-batch

## Summary

- `return` gives a value to the program; `print` shows it to a person.
- Variables inside a function stay inside, which makes it easy to reason about.
- Small, named, testable functions are how large programs stay understandable.

:::quiz pf-functions
