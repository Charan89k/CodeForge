## Why learn sorting when `sorted()` exists

You will rarely write a sort. You learn them because they are the clearest examples of the main ideas in algorithms: divide and conquer, in-place work, trade-offs between time and space, and lower bounds. They also make library behaviour, such as stability, understandable.

## Simple sorts: O(n²)

**Insertion sort** grows a sorted section on the left. It takes the next item and shifts larger items right until the item fits, as many people sort a hand of cards.

```python
def insertion_sort(items):
    items = items[:]
    for i in range(1, len(items)):
        current = items[i]
        j = i - 1
        while j >= 0 and items[j] > current:
            items[j + 1] = items[j]
            j -= 1
        items[j + 1] = current
    return items

print(insertion_sort([5, 2, 4, 1]))
```

```text
[1, 2, 4, 5]
```

It is quadratic in general but close to linear on nearly sorted data, and very fast on small arrays. That is why practical library sorts use it on short runs.

:::visualization insertion-sort

## Merge sort: divide and conquer

Split the list in half, sort each half, and merge them. Merging two sorted lists takes linear time, because you only ever compare the two front items.

```python
def merge_sort(items):
    if len(items) <= 1:
        return items
    middle = len(items) // 2
    left, right = merge_sort(items[:middle]), merge_sort(items[middle:])
    merged = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1
    return merged + left[i:] + right[j:]

print(merge_sort([38, 27, 43, 3, 9, 82, 10]))
```

```text
[3, 9, 10, 27, 38, 43, 82]
```

There are about log n levels of splitting, each doing n work, so it takes **O(n log n) in every case**. The cost is O(n) extra space. It is also **stable**: equal items keep their original order, because of the `<=`.

## Quicksort: partition in place

Pick a **pivot**, and move smaller items to its left and larger ones to its right. The pivot is now in its final place, so sort each side.

```python
def quicksort(items, low=0, high=None):
    if high is None:
        high = len(items) - 1
    if low >= high:
        return items
    pivot = items[high]
    boundary = low
    for i in range(low, high):
        if items[i] < pivot:
            items[i], items[boundary] = items[boundary], items[i]
            boundary += 1
    items[boundary], items[high] = items[high], items[boundary]
    quicksort(items, low, boundary - 1)
    quicksort(items, boundary + 1, high)
    return items

print(quicksort([3, 6, 1, 8, 2, 9, 2]))
```

```text
[1, 2, 2, 3, 6, 8, 9]
```

It averages O(n log n), needs little extra memory, and is fast in practice. A bad pivot every time gives O(n²). This code always uses the last item as the pivot, so it is quadratic on already sorted input. Choosing pivots at random makes that very unlikely.

| Sort | Best | Average | Worst | Extra space | Stable |
|---|---|---|---|---|---|
| Insertion | O(n) | O(n²) | O(n²) | O(1) | Yes |
| Merge | O(n log n) | O(n log n) | O(n log n) | O(n) | Yes |
| Quick | O(n log n) | O(n log n) | O(n²) | O(log n) | No |
| Heap | O(n log n) | O(n log n) | O(n log n) | O(1) | No |

## Stability matters

Sort orders by date, then sort by customer with a stable sort, and each customer's orders stay in date order. Python's `sorted` is stable, which makes this a standard technique.

```python
orders = [("Ravi", 3), ("Asha", 2), ("Ravi", 1), ("Asha", 1)]
by_date = sorted(orders, key=lambda order: order[1])
by_customer = sorted(by_date, key=lambda order: order[0])
print(by_customer)
```

```text
[('Asha', 1), ('Asha', 2), ('Ravi', 1), ('Ravi', 3)]
```

## Can sorting beat n log n?

Any sort that works only by comparing items needs at least about n log n comparisons in the worst case. There are n! possible orderings, and each comparison can at best rule out half of them.

Sorts that do not compare can do better when the values have structure. **Counting sort** handles small whole numbers in O(n + k), where k is the range of values.

```python
def counting_sort(items, largest):
    counts = [0] * (largest + 1)
    for item in items:
        counts[item] += 1
    return [value for value, count in enumerate(counts) for _ in range(count)]

print(counting_sort([3, 1, 2, 3, 0], 3))
```

```text
[0, 1, 2, 3, 3]
```

## Try it

Sorted data unlocks other techniques. Try these on the judge. The first needs the sort itself, and the others use order as a tool.

:::problems sort-signed-squares consolidate-booked-slots sorted-pair-target

## Summary

- Merge sort is always O(n log n) and stable, but needs extra space.
- Quicksort is fast and nearly in place, but needs sensible pivots to avoid O(n²).
- Comparison sorts cannot beat n log n in general. Counting sort avoids comparisons when values are small.

:::quiz ca-sorting
