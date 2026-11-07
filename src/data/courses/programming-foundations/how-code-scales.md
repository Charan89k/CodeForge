## Working code can still be too slow

A program that takes a moment on 100 items may take hours on a million. Before you can fix that, you need a way to describe how the work grows with the input, without a stopwatch. That description is called time complexity.

Count the steps as a function of the input size `n`. Ignore constant factors, because what decides the fate of a program at scale is the shape of the growth.

## Three shapes you will see all the time

A single loop over the input does work in proportion to `n`, written O(n). Finding a value this way may check every item.

```python
def contains(items, target):
    steps = 0
    for item in items:
        steps += 1
        if item == target:
            break
    return steps

print(contains(list(range(1000)), 999))
```

```text
1000
```

A loop inside a loop over the same input does about `n * n` steps, written O(n²). Double the input and the work quadruples.

```python
def count_pairs(n):
    steps = 0
    for i in range(n):
        for j in range(n):
            steps += 1
    return steps

print(count_pairs(10), count_pairs(20))
```

```text
100 400
```

A dictionary or set lookup takes about the same time at any size, written O(1). Halving the search space each step, as binary search does, takes O(log n).

```python
n = 1000000
steps = 0
while n > 1:
    n = n // 2
    steps += 1
print(steps)
```

```text
19
```

Nineteen steps for a million items is why sorted data is so valuable.

| Growth | Name | Steps for n = 1,000,000 |
|---|---|---|
| O(1) | constant | 1 |
| O(log n) | logarithmic | about 20 |
| O(n) | linear | 1,000,000 |
| O(n²) | quadratic | 1,000,000,000,000 |

At a billion simple steps a second, the last row takes over 11 days. The linear row takes a thousandth of a second.

## The same problem, two costs

Does any pair in a list add up to a target? The direct way checks every pair.

```python
def has_pair_slow(numbers, target):
    for i in range(len(numbers)):
        for j in range(i + 1, len(numbers)):
            if numbers[i] + numbers[j] == target:
                return True
    return False

print(has_pair_slow([3, 8, 12, 5], 13))
```

```text
True
```

That is O(n²). Now use what you learned about sets. For each number, you know exactly what partner it needs, so remember what you have seen and ask.

```python
def has_pair_fast(numbers, target):
    seen = set()
    for number in numbers:
        if target - number in seen:
            return True
        seen.add(number)
    return False

print(has_pair_fast([3, 8, 12, 5], 13))
```

```text
True
```

One pass, so O(n). The cost is memory for the set. Trading memory for speed is one of the most common moves in programming, and much of the DSA Foundations course is about recognising when you can make it.

> [!note] Fast enough is fast enough
> Complexity tells you how code scales, not whether you need to care today. For a list of 50 items, the clearer version is often right. Worry when the input can really grow, or when a slow step sits inside another loop.

## Hidden loops

A line that looks like one step may not be. `x in some_list` walks the list, so using it inside a loop makes that loop quadratic. `x in some_set` does not. `sorted()` costs about O(n log n). When code feels slow, ask what each line is really doing.

## Try it

What is the complexity of this function? It has one visible loop, but look at the `in`.

```python
def unique_count(items):
    seen = []
    for item in items:
        if item not in seen:
            seen.append(item)
    return len(seen)

print(unique_count([1, 2, 1, 3]))
```

```text
3
```

It is O(n²) in the worst case, since `seen` is a list. Making `seen` a set brings it to O(n), and that is a one-word change. Now apply the idea to a real problem.

:::problems matching-pair-sum duplicate-within-distance

## Where to go next

You now have what you need to start DSA Foundations: variables, decisions, loops, collections, functions, debugging and a feel for cost.

## Summary

- Complexity describes how work grows with input, not how long it takes on your machine.
- Nested loops over the same input are O(n²), and a set or dictionary often brings them down to O(n).
- Look for the hidden loops inside single lines.

:::quiz pf-how-code-scales
