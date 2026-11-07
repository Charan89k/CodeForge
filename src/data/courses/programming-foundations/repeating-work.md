## Loops replace copy and paste

When a step repeats, do not write it repeatedly. A `for` loop runs its block once for each item in a sequence.

```python
for name in ["Asha", "Ravi", "Meena"]:
    print(f"Hello, {name}")
```

```text
Hello, Asha
Hello, Ravi
Hello, Meena
```

`range(n)` gives the numbers from 0 up to but not including `n`, which is what you want for "do this n times". `range(a, b)` starts from `a`.

```python
for i in range(3):
    print(i)
print(list(range(2, 6)))
```

```text
0
1
2
[2, 3, 4, 5]
```

## The accumulator pattern

Most loops build up an answer. Start a variable outside the loop, update it inside, and use it afterwards.

```python
prices = [120, 45, 300]
total = 0
for price in prices:
    total = total + price
print(total)
```

```text
465
```

Trace it: `total` goes 0, 120, 165, 465. The same shape counts things, or finds a largest value.

```python
readings = [14, 31, 7, 31, 22]
largest = readings[0]
above_twenty = 0
for value in readings:
    if value > largest:
        largest = value
    if value > 20:
        above_twenty += 1
print(largest, above_twenty)
```

```text
31 3
```

> [!warning] Start from real data
> Setting `largest = 0` looks fine until every reading is negative, when it reports 0, a value that was never in the list. Starting from `readings[0]` cannot go wrong that way, though it does need the list to be non-empty.

## while repeats until something changes

Use `while` when you do not know the number of repeats in advance. It checks its condition before each pass.

```python
balance = 1000
years = 0
while balance < 2000:
    balance = balance * 2
    years += 1
print(years, balance)
```

```text
1 2000
```

Something in the block must move the condition towards false. Remove `balance = balance * 2` and the loop runs forever. If your program seems frozen, this is the first thing to check.

## Leaving early

`break` stops the loop at once, and `continue` skips to the next item. Stopping as soon as the answer is known saves work.

```python
orders = [150, 900, 40, 1200]
for amount in orders:
    if amount > 800:
        print("First large order:", amount)
        break
```

```text
First large order: 900
```

## Loops inside loops

The inner loop runs fully for each pass of the outer one, so the work multiplies. Two loops of 3 and 2 give 6 prints.

```python
for row in range(1, 4):
    line = ""
    for col in range(1, 3):
        line += f"{row * col} "
    print(line.strip())
```

```text
1 2
2 4
3 6
```

## Try it

Given a run of characters, compress repeats so `"aaabcc"` becomes `"a3b1c2"`. By hand you would walk along the string, counting the current run, and write it down when the letter changes. Try it first.

```python
text = "aaabcc"
out = ""
count = 1
for i in range(1, len(text) + 1):
    if i < len(text) and text[i] == text[i - 1]:
        count += 1
    else:
        out += f"{text[i - 1]}{count}"
        count = 1
print(out)
```

```text
a3b1c2
```

Then try a harder version on the judge.

:::problems compress-run-lengths running-altitude

## Summary

- `for` runs once per item, and `range` makes counting easy.
- Accumulate by starting outside the loop and updating inside it.
- A `while` loop must change something its condition depends on.

:::quiz pf-repeating-work
