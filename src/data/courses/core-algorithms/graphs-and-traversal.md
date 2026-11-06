## Anything connected to anything

A tree has one parent per node. Real connections are messier. Roads form cycles, friendships run both ways, and a course can have several prerequisites. A **graph** is a set of **vertices** joined by **edges**, with no shape imposed.

Three questions describe any graph. Are edges **directed**, like a one-way street, or undirected? Are they **weighted**, with a distance or cost? Does it contain **cycles**?

## Storing a graph

| Form | Space | Is there an edge a to b? | List a's neighbours |
|---|---|---|---|
| Adjacency list | O(V + E) | Up to O(degree) | O(degree) |
| Adjacency matrix | O(V²) | O(1) | O(V) |

Most real graphs have few edges per vertex, so the adjacency list is the usual choice. V is the number of vertices, and E is the number of edges.

```python
def build(edges):
    graph = {}
    for a, b in edges:
        graph.setdefault(a, []).append(b)
        graph.setdefault(b, []).append(a)
    return graph

print(build([("A", "B"), ("A", "C"), ("B", "D")]))
```

```text
{'A': ['B', 'C'], 'B': ['A', 'D'], 'C': ['A'], 'D': ['B']}
```

## Breadth-first search

BFS explores in widening rings: everything one step away, then two steps, and so on. A queue enforces that order. Because it reaches each vertex by the fewest edges first, **BFS finds shortest paths when every edge costs the same.**

```python
from collections import deque

GRAPH = {"A": ["B", "C"], "B": ["A", "D"], "C": ["A", "D"], "D": ["B", "C", "E"], "E": ["D"]}

def distances(start):
    dist = {start: 0}
    queue = deque([start])
    while queue:
        node = queue.popleft()
        for neighbour in GRAPH[node]:
            if neighbour not in dist:
                dist[neighbour] = dist[node] + 1
                queue.append(neighbour)
    return dist

print(distances("A"))
```

```text
{'A': 0, 'B': 1, 'C': 1, 'D': 2, 'E': 3}
```

Mark a vertex as seen when you add it to the queue, not when you remove it. Otherwise, one vertex can be queued many times.

:::visualization breadth-first-search

## Depth-first search

DFS follows one path as far as it can, then backs up. It uses a stack, usually the call stack through recursion. It does not find shortest paths, but it suits questions about structure: reachability, connected pieces and cycles.

```python
GRAPH = {"A": ["B", "C"], "B": ["A", "D"], "C": ["A", "D"], "D": ["B", "C", "E"], "E": ["D"]}

def dfs(node, seen):
    seen.append(node)
    for neighbour in GRAPH[node]:
        if neighbour not in seen:
            dfs(neighbour, seen)
    return seen

print(dfs("A", []))
```

```text
['A', 'B', 'D', 'C', 'E']
```

Both BFS and DFS visit each vertex and edge once, so both cost O(V + E). The `seen` list above is for clarity. Use a set in real code, or the membership check itself becomes a hidden loop.

:::visualization depth-first-search

| Question | Use |
|---|---|
| Fewest steps, equal costs | BFS |
| Is B reachable from A | Either |
| How many separate pieces | Either, restarting from each unseen vertex |
| Does a directed graph have a cycle | DFS, or topological sort |

## Grids are graphs

Each cell is a vertex, and its neighbours are the cells next to it. There is no need to build a graph object. Here DFS counts islands of connected land.

```python
def islands(grid):
    rows, cols = len(grid), len(grid[0])
    seen = set()

    def sink(r, c):
        if not (0 <= r < rows and 0 <= c < cols):
            return
        if grid[r][c] == "." or (r, c) in seen:
            return
        seen.add((r, c))
        for dr, dc in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
            sink(r + dr, c + dc)

    count = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == "#" and (r, c) not in seen:
                count += 1
                sink(r, c)
    return count

print(islands(["##..", "#..#", "...#"]))
```

```text
2
```

## Ordering by dependency

Courses have prerequisites, and build steps depend on one another. A **topological order** lists tasks so that each comes after what it needs. It exists only for a directed graph with no cycles. Repeatedly take any task with nothing left waiting on it.

```python
from collections import deque

def order(tasks, needs):
    waiting = {task: 0 for task in tasks}
    unlocks = {task: [] for task in tasks}
    for task, requirement in needs:
        waiting[task] += 1
        unlocks[requirement].append(task)
    ready = deque(task for task in tasks if waiting[task] == 0)
    result = []
    while ready:
        task = ready.popleft()
        result.append(task)
        for next_task in unlocks[task]:
            waiting[next_task] -= 1
            if waiting[next_task] == 0:
                ready.append(next_task)
    return result if len(result) == len(tasks) else None

print(order(["code", "test", "ship"], [("test", "code"), ("ship", "test")]))
print(order(["a", "b"], [("a", "b"), ("b", "a")]))
```

```text
['code', 'test', 'ship']
None
```

`None` means a cycle: some tasks wait on each other forever.

## Try it

:::problems route-exists count-reefs shortest-corridor curriculum-order

## Summary

- Store most graphs as an adjacency list, and mark vertices as seen when you first reach them.
- BFS gives shortest paths when edges cost the same. DFS suits questions about structure. Both are O(V + E).
- A grid is a graph, and a topological order exists only with no cycles.

:::quiz ca-graphs-and-traversal
