## Stop solving the same problem twice

Plain recursive Fibonacci is famously slow. Count its calls.

```python
calls = 0

def fib(n):
    global calls
    calls += 1
    return n if n < 2 else fib(n - 1) + fib(n - 2)

print(fib(20), calls)
```

```text
6765 21891
```

Almost 22,000 calls for only 21 different inputs. `fib(18)` alone is worked out twice, and each of those repeats everything beneath it. **Dynamic programming** (DP) is one idea: when a recursion repeats the same subproblems, save each answer the first time.

## Two ways to save answers

**Memoization** keeps the recursion and adds a dictionary. This is usually the easiest way to start.

```python
calls = 0
saved = {}

def fib(n):
    global calls
    calls += 1
    if n < 2:
        return n
    if n not in saved:
        saved[n] = fib(n - 1) + fib(n - 2)
    return saved[n]

print(fib(20), calls)
```

```text
6765 39
```

**Tabulation** drops the recursion, and fills a table from the smallest cases upward. It has no recursion limit, and often lets you keep less memory.

```python
def fib(n):
    previous, current = 0, 1
    for _ in range(n):
        previous, current = current, previous + current
    return previous

print(fib(20))
```

```text
6765
```

Both take O(n) time rather than exponential. The second also needs only O(1) space, since each value depends on just the previous two.

## When DP applies

Two properties together signal DP.

- **Overlapping subproblems:** the same smaller questions come up repeatedly. Without overlap, it is plain divide and conquer, like merge sort.
- **Optimal substructure:** the best answer to the whole is built from best answers to the parts.

## A method that works

Most DP problems fall to the same four steps. The first is where the real thinking happens.

1. **Define the state:** in plain words, what does `dp[i]` mean? If you cannot say it in a sentence, stop here.
2. **Write the recurrence:** how does `dp[i]` follow from smaller states? Think about the last decision made.
3. **Set the base cases:** the smallest answers you know directly.
4. **Choose the order, and read off the answer:** fill states so everything needed is already done.

## Worked example: fewest coins

The last lesson showed greed failing here. Apply the steps.

1. **State:** `dp[a]` is the fewest coins that make the amount `a`.
2. **Recurrence:** the last coin used was some coin `c`, so `dp[a] = 1 + min(dp[a - c])` over all coins that fit.
3. **Base:** `dp[0] = 0`.
4. **Order:** amounts from small to large. The answer is `dp[amount]`.

```python
def fewest_coins(amount, coins):
    impossible = amount + 1
    dp = [0] + [impossible] * amount
    for a in range(1, amount + 1):
        for coin in coins:
            if coin <= a:
                dp[a] = min(dp[a], 1 + dp[a - coin])
    return dp[amount] if dp[amount] != impossible else -1

print(fewest_coins(6, [1, 3, 4]))
print(fewest_coins(7, [2, 4]))
```

```text
2
-1
```

That costs O(amount × coins) time and O(amount) space. It tries every last coin rather than committing to one, and that is why it succeeds where greed failed.

## Counting instead of minimising

The method also counts. How many ways can you climb n stairs taking 1 or 2 steps? The last step was 1 or 2, so `ways[n] = ways[n - 1] + ways[n - 2]`.

```python
def climb(n):
    ways = [1, 1] + [0] * (n - 1)
    for i in range(2, n + 1):
        ways[i] = ways[i - 1] + ways[i - 2]
    return ways[n]

print([climb(n) for n in range(1, 7)])
```

```text
[1, 2, 3, 5, 8, 13]
```

> [!warning] A common mistake in the counting version
> When counting coin combinations, loop over coins first if order should not matter, or 1+2 and 2+1 count as different. The order of the loops changes the question being answered.

## Try it

For each, write the state in a sentence before any code.

:::problems count-climb-routes fewest-tokens-for-fare count-change-combinations

## Summary

- DP saves answers to overlapping subproblems, turning exponential work into polynomial.
- Memoization adds a cache to a recursion, and tabulation fills a table upward.
- Define the state in words first, then think about the last decision.

:::quiz ca-dynamic-programming-basics
