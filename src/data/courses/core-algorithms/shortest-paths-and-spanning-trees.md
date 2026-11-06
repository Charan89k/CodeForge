## When edges have different costs

BFS counts edges. A route of three short roads can beat one long motorway, so counting is no longer enough. **Dijkstra's algorithm** finds the cheapest path from one start vertex when no edge cost is negative.

The idea: always settle the unsettled vertex with the smallest known distance. With no negative edges, no later route can improve it, because any other route must go through something at least as far away. A heap provides that smallest vertex.

```python
import heapq

GRAPH = {
    "A": [("B", 4), ("C", 1)],
    "B": [("D", 1)],
    "C": [("B", 2), ("D", 5)],
    "D": [],
}

def dijkstra(start):
    dist = {start: 0}
    heap = [(0, start)]
    while heap:
        cost, node = heapq.heappop(heap)
        if cost > dist[node]:
            continue
        for neighbour, weight in GRAPH[node]:
            new_cost = cost + weight
            if new_cost < dist.get(neighbour, float("inf")):
                dist[neighbour] = new_cost
                heapq.heappush(heap, (new_cost, neighbour))
    return dist

print(dijkstra("A"))
```

```text
{'A': 0, 'B': 3, 'C': 1, 'D': 4}
```

Trace B. The direct edge costs 4, but A to C to B costs 3. The stale `(4, "B")` entry stays in the heap, and the `cost > dist[node]` check skips it when it surfaces.

With a heap, this costs O((V + E) log V).

:::visualization dijkstra

> [!warning] Negative edges break it
> Dijkstra's reasoning depends on costs never going down. With negative edges it can give wrong answers without any error. Use Bellman-Ford instead, which relaxes every edge V - 1 times, at O(V × E).

| Situation | Algorithm | Cost |
|---|---|---|
| Equal edge costs | BFS | O(V + E) |
| Non-negative costs | Dijkstra | O((V + E) log V) |
| Some negative costs | Bellman-Ford | O(V × E) |

## Keeping track of groups

Before spanning trees, a tool. **Disjoint set union** (DSU, or union-find) tracks which items belong together. Two operations: which group is x in, and merge two groups. Each group is a small tree identified by its root.

```python
class DSU:
    def __init__(self, n):
        self.parent = list(range(n))

    def find(self, x):
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False
        self.parent[ra] = rb
        return True

groups = DSU(4)
print(groups.union(0, 1), groups.union(2, 3), groups.union(1, 0))
print(groups.find(0) == groups.find(1), groups.find(0) == groups.find(2))
```

```text
True True False
True False
```

The line inside `find` that points nodes at their grandparents is **path compression**. Combined with union by size or rank, each operation takes almost constant time in practice.

## Minimum spanning trees

Suppose you must connect every office with cable, at least total cost. You need no cycles, since a cycle has a cable you could remove. That makes the answer a tree spanning all vertices: a **minimum spanning tree** (MST). Note that this is a different question from shortest paths. An MST minimises the total network, not any one route.

**Kruskal's algorithm** is greedy. Sort the edges by cost, then take each one unless it would form a cycle. DSU answers the cycle question directly: an edge between two vertices already in one group would close a loop.

```python
class DSU:
    def __init__(self, n):
        self.parent = list(range(n))

    def find(self, x):
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False
        self.parent[ra] = rb
        return True

def kruskal(n, edges):
    groups = DSU(n)
    chosen = []
    total = 0
    for cost, a, b in sorted(edges):
        if groups.union(a, b):
            chosen.append((a, b))
            total += cost
    return total, chosen

print(kruskal(4, [(1, 0, 1), (4, 0, 2), (3, 1, 2), (2, 2, 3), (5, 1, 3)]))
```

```text
(6, [(0, 1), (2, 3), (1, 2)])
```

Sorting dominates, so this costs O(E log E). **Prim's algorithm** reaches the same total by growing one tree outward using a heap, and it is often preferred on dense graphs.

## Try it

Why not use Dijkstra for the office cabling? Take offices A, B and C, with A-B costing 2, A-C costing 2, and B-C costing 1. Dijkstra from A keeps both edges from A, for a total of 4. The MST uses B-C and one edge from A, for a total of 3. Different questions need different algorithms.

:::problems cheapest-trip broadcast-delay study-circles surplus-cable

## Summary

- Dijkstra settles the nearest unsettled vertex, using a heap, and needs non-negative costs.
- Disjoint set union tracks groups and detects cycles in almost constant time per operation.
- A minimum spanning tree minimises the whole network. Kruskal takes the cheapest edges that do not form a cycle.

:::quiz ca-shortest-paths-and-spanning-trees
