## Always knowing the most urgent item

A hospital treats the most urgent patient next, not the one who arrived first. A **priority queue** offers two operations: add an item, and remove the one with the highest priority. A sorted list makes additions slow. An unsorted list makes removal slow. A **heap** makes both O(log n).

## The heap rule

A **min-heap** is a binary tree where every parent is less than or equal to its children. So the smallest value is always at the root. That is all it promises. Siblings have no order, so a heap is not sorted.

The clever part is the storage. A heap is kept complete, filled level by level, so it fits in a plain array with no pointers. For the node at index `i`, its children are at `2*i + 1` and `2*i + 2`, and its parent is at `(i - 1) // 2`.

To **add**, put the value at the end and swap it upwards while it is smaller than its parent. To **remove**, take the root, move the last item to the top, and swap it downwards with its smaller child. Each moves along one path, so both cost O(log n).

```python
def push(heap, value):
    heap.append(value)
    i = len(heap) - 1
    while i > 0 and heap[(i - 1) // 2] > heap[i]:
        parent = (i - 1) // 2
        heap[i], heap[parent] = heap[parent], heap[i]
        i = parent

heap = []
for value in [5, 3, 8, 1]:
    push(heap, value)
    print(heap)
```

```text
[5]
[3, 5]
[3, 5, 8]
[1, 3, 8, 5]
```

The array is not sorted, but its first element is always the smallest.

:::visualization min-heap

## Using the standard library

Python's `heapq` provides a min-heap on an ordinary list. You will use this far more often than writing your own.

```python
import heapq

tasks = []
heapq.heappush(tasks, (2, "write report"))
heapq.heappush(tasks, (1, "fix outage"))
heapq.heappush(tasks, (3, "tidy desk"))
while tasks:
    print(heapq.heappop(tasks))
```

```text
(1, 'fix outage')
(2, 'write report')
(3, 'tidy desk')
```

Tuples compare by their first element, so a `(priority, item)` pair works directly. For a max-heap, push negated priorities.

> [!warning] Ties can crash
> If two priorities are equal, Python compares the next tuple element. If those items cannot be compared, such as two dictionaries, you get a `TypeError`. Put a running counter between the priority and the item to break ties.

## The top-k pattern

Which are the 3 largest values in a stream of a million? Sorting costs O(n log n) and needs everything in memory. Instead, keep a min-heap of size k. Its root is the smallest of your current top k, so a new value only matters if it beats the root.

```python
import heapq

def top_k(values, k):
    heap = []
    for value in values:
        heapq.heappush(heap, value)
        if len(heap) > k:
            heapq.heappop(heap)
    return sorted(heap, reverse=True)

print(top_k([5, 1, 9, 3, 7, 8, 2], 3))
```

```text
[9, 8, 7]
```

This takes O(n log k) time and O(k) space. It works on a stream too, because it never needs all the data at once.

A min-heap for the largest values feels backwards at first. Remember that the heap's job is to make the weakest of the current winners easy to throw out.

## Merging sorted lists

Given several sorted lists, the next output is always the smallest of their current front items, and a heap holds exactly those.

```python
import heapq

def merge_lists(lists):
    heap = [(items[0], i, 0) for i, items in enumerate(lists) if items]
    heapq.heapify(heap)
    merged = []
    while heap:
        value, i, position = heapq.heappop(heap)
        merged.append(value)
        if position + 1 < len(lists[i]):
            heapq.heappush(heap, (lists[i][position + 1], i, position + 1))
    return merged

print(merge_lists([[1, 4], [2, 5], [0, 3]]))
```

```text
[0, 1, 2, 3, 4, 5]
```

## Try it

Solve these on the judge. Ask yourself first what the heap holds, and how large it needs to be.

:::problems kth-loudest-reading merge-sorted-feeds top-search-terms

## Summary

- A heap keeps the smallest value at the root, with add and remove in O(log n).
- It is stored in an array and is not sorted.
- For the top k of n items, keep a heap of size k: O(n log k) time and O(k) space.

:::quiz ca-heaps-and-priority-queues
