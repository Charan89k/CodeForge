## Decide now, never look back

A **greedy algorithm** builds an answer one step at a time, always taking what looks best at that moment, and never reconsiders. When it works, it is simple and fast. The hard part is not writing it: it is knowing whether it is correct, because a greedy algorithm can be plausible and wrong.

## When greed fails

Make 6 rupees using the fewest coins, from denominations 1, 3 and 4. Taking the largest coin first looks sensible.

```python
def greedy_coins(amount, coins):
    used = []
    for coin in sorted(coins, reverse=True):
        while amount >= coin:
            amount -= coin
            used.append(coin)
    return used

print(greedy_coins(6, [1, 3, 4]))
print(greedy_coins(63, [1, 2, 5, 10, 20, 50]))
```

```text
[4, 1, 1]
[50, 10, 2, 1]
```

The first answer uses 3 coins, but 3 + 3 uses only 2. The second works, because everyday currency is designed so that greed succeeds. Same code, same logic, and whether it is correct depends on the input's structure. For arbitrary coins, you need dynamic programming, in the next lesson.

> [!insight] Test greedy ideas by attacking them
> Before trusting a greedy rule, try to break it with a small example. A few minutes of hunting for a counterexample often saves an hour of debugging. If you cannot explain why the choice is safe, be suspicious.

## Scheduling: when greed succeeds

You have one meeting room and many requests. Keep as many meetings as possible. What should you choose first?

| Rule | Counterexample |
|---|---|
| Shortest meeting first | A short meeting straddling two longer ones blocks both |
| Earliest start first | One very long early meeting blocks everything |
| **Earliest finish first** | None: this one is correct |

```python
def most_meetings(meetings):
    chosen = []
    free_at = 0
    for start, end in sorted(meetings, key=lambda meeting: meeting[1]):
        if start >= free_at:
            chosen.append((start, end))
            free_at = end
    return chosen

print(most_meetings([(1, 4), (3, 5), (0, 6), (5, 7), (8, 9), (5, 9)]))
```

```text
[(1, 4), (5, 7), (8, 9)]
```

## Why it is safe: the exchange argument

Take any best schedule, and consider its first meeting. The meeting that finishes earliest of all ends no later than that one. So swap it in: nothing conflicts, since it frees the room at least as soon, and the count is unchanged. That means some best schedule starts with our choice. Apply the same reasoning to what remains, and the whole greedy schedule is optimal.

That is the **exchange argument**, the standard way to prove a greedy algorithm: show that any optimal answer can be changed to include the greedy choice without getting worse.

## The shape of greedy code

Most greedy solutions sort by the key insight, then make one pass, so they cost O(n log n). Sometimes no sort is needed. Here we walk along stones, tracking the furthest reachable position.

```python
def can_reach_end(jumps):
    furthest = 0
    for position, jump in enumerate(jumps):
        if position > furthest:
            return False
        furthest = max(furthest, position + jump)
    return True

print(can_reach_end([2, 3, 1, 1, 4]))
print(can_reach_end([3, 2, 1, 0, 4]))
```

```text
True
False
```

Earlier you met two more greedy algorithms: Dijkstra always settles the nearest vertex, and Kruskal always takes the cheapest safe edge.

## Greedy or dynamic programming?

| Signal | Likely approach |
|---|---|
| A simple sort order makes each choice clearly safe | Greedy |
| An exchange argument works | Greedy |
| You can find a small counterexample to every simple rule | Dynamic programming |
| The best choice depends on what comes later | Dynamic programming |

## Try it

Each of these has a greedy solution. Before coding, state your rule, and try to break it with a small example.

:::problems can-reach-last-stone attend-every-meeting truck-unit-loading

## Summary

- A greedy algorithm commits to the best-looking choice, and never revisits it.
- It can be plausible and wrong, so hunt for counterexamples first.
- Prove it with an exchange argument: any best answer can be changed to include the greedy choice.

:::quiz ca-greedy-choices
