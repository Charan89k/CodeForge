## A few shapes repeat

DP looks like endless separate tricks until you notice that most problems use a handful of state shapes. Recognising the shape gives you the state, and the state is most of the work.

| Shape | State means | Example |
|---|---|---|
| One sequence | Best answer ending at, or up to, position i | Longest rising run |
| Two sequences | Answer for the first i of A and first j of B | Common subsequence, edit distance |
| Knapsack | Answer using the first i items with capacity c | Packing, subset sums |
| Grid | Answer for reaching cell (r, c) | Counting paths |

## One sequence: longest increasing subsequence

A subsequence keeps order but can skip items. Let `dp[i]` be the longest increasing subsequence **ending exactly at** index i. Any earlier smaller item can come just before it.

```python
def longest_rising(values):
    dp = [1] * len(values)
    for i in range(len(values)):
        for j in range(i):
            if values[j] < values[i]:
                dp[i] = max(dp[i], dp[j] + 1)
    return max(dp)

print(longest_rising([10, 9, 2, 5, 3, 7, 101, 18]))
```

```text
4
```

One such subsequence is 2, 3, 7, 18. The answer is the largest value in `dp`, not the last, because the best one may end anywhere. Notice how "ending exactly at i" makes the recurrence possible: to extend a sequence, you must know its last value.

## Two sequences: longest common subsequence

Compare the last characters of two prefixes. If they match, they extend the answer for both shorter prefixes. If not, drop one or the other and take the better result.

```python
def lcs(a, b):
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[len(a)][len(b)]

print(lcs("ABCBDAB", "BDCABA"))
```

```text
4
```

:::visualization longest-common-subsequence

Tools that compare files use this idea to work out which lines changed. Edit distance has the same table, with its recurrence counting insertions, deletions and replacements.

## Knapsack: take it or leave it

Each item has a weight and a value, and the bag has a limit. For each item there are two choices, so `dp[c]` is the best value within capacity c.

```python
def knapsack(items, limit):
    dp = [0] * (limit + 1)
    for weight, value in items:
        for c in range(limit, weight - 1, -1):
            dp[c] = max(dp[c], dp[c - weight] + value)
    return dp[limit]

print(knapsack([(1, 1), (3, 4), (4, 5), (5, 7)], 7))
```

```text
9
```

The bag holds the items of weight 3 and 4, for a value of 9.

> [!warning] Why the capacity loop runs backwards
> Going downward means `dp[c - weight]` still holds the value from before this item, so each item is used at most once. Run it upward and an item can be taken repeatedly. That is a different problem, the unbounded knapsack.

The cost is O(items × limit). That looks polynomial, but the limit is a number rather than a count of inputs, so large limits still hurt.

## Grids

The number of paths to a cell, moving only right or down, is the sum of the paths to the cell above and the cell to the left.

```python
def paths(grid):
    rows, cols = len(grid), len(grid[0])
    dp = [[0] * cols for _ in range(rows)]
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == "#":
                continue
            if r == 0 and c == 0:
                dp[r][c] = 1
            else:
                above = dp[r - 1][c] if r > 0 else 0
                left = dp[r][c - 1] if c > 0 else 0
                dp[r][c] = above + left
    return dp[rows - 1][cols - 1]

print(paths(["...", ".#.", "..."]))
```

```text
2
```

## Saving space

When a row depends only on the row before it, keep just one row. That is what the knapsack above already does, using O(limit) rather than O(items × limit) memory. The catch is that you can no longer reconstruct which items were chosen. If you need the choices themselves, keep the full table.

## Finding the shape

Ask these in order when you meet a new problem.

1. One sequence, two sequences, items with a limit, or a grid?
2. What single sentence defines the state?
3. What was the last decision? List its options.
4. Does a state's answer need to end exactly at i, or just use items up to i?

## Try it

Name the shape before coding each one.

:::problems longest-rising-sequence longest-shared-subsequence pack-the-rucksack roadworks-grid-routes min-edit-steps

## Summary

- Most DP problems use one of a few shapes: one sequence, two sequences, knapsack or grid.
- "Ending exactly at i" lets a sequence be extended, and the answer is then the best across all i.
- Run a one-row knapsack's capacity downward so that each item is used once.

:::quiz ca-dynamic-programming-patterns
