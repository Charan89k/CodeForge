## A sorted structure you can still change

A sorted array finds a value in O(log n), but inserting into the middle moves everything after it. A linked list inserts cheaply but cannot jump to the middle. A **binary search tree** (BST) aims for both.

One rule defines it: for every node, all values in the left subtree are smaller and all values in the right subtree are larger. Not just the immediate children: the whole subtree.

## Searching and inserting

Each comparison discards one side, exactly like binary search.

```python
class Node:
    def __init__(self, value):
        self.value, self.left, self.right = value, None, None

def insert(node, value):
    if node is None:
        return Node(value)
    if value < node.value:
        node.left = insert(node.left, value)
    elif value > node.value:
        node.right = insert(node.right, value)
    return node

def contains(node, value):
    while node:
        if value == node.value:
            return True
        node = node.left if value < node.value else node.right
    return False

def inorder(node):
    return [] if node is None else inorder(node.left) + [node.value] + inorder(node.right)

root = None
for value in [50, 30, 70, 20, 40]:
    root = insert(root, value)
print(contains(root, 40), contains(root, 45))
print(inorder(root))
```

```text
True False
[20, 30, 40, 50, 70]
```

Inorder traversal gives sorted output, as the rule guarantees: everything left of a node is smaller, and everything right of it is larger.

:::visualization bst-insert

## Shape decides speed

Each operation costs the height of the tree. Height depends on the order of insertion, not on the values.

```python
class Node:
    def __init__(self, value):
        self.value, self.left, self.right = value, None, None

def insert(node, value):
    if node is None:
        return Node(value)
    if value < node.value:
        node.left = insert(node.left, value)
    else:
        node.right = insert(node.right, value)
    return node

def height(node):
    return -1 if node is None else 1 + max(height(node.left), height(node.right))

def build(values):
    root = None
    for value in values:
        root = insert(root, value)
    return root

print(height(build([4, 2, 6, 1, 3, 5, 7])))
print(height(build([1, 2, 3, 4, 5, 6, 7])))
```

```text
2
6
```

The same seven values give height 2 or height 6. Sorted input produces a chain, and a chain is just a slow linked list, so search degrades from O(log n) to O(n).

**Self-balancing trees**, such as red-black trees and AVL trees, rotate nodes during insertion to keep the height near log n. You rarely write one yourself. Databases use a close relative, the B-tree, for their indexes.

| Operation | Balanced BST | Chain-shaped BST | Sorted array | Hash table |
|---|---|---|---|---|
| Find a value | O(log n) | O(n) | O(log n) | O(1) on average |
| Insert | O(log n) | O(n) | O(n) | O(1) on average |
| All values in order | O(n) | O(n) | O(n) | O(n log n), must sort |
| Nearest value below x | O(log n) | O(n) | O(log n) | O(n) |

A hash table wins on exact lookups. A BST wins when order matters: ranges, nearest neighbours, or walking in sequence.

## Removing a node

There are three cases. A leaf is simply removed. A node with one child is replaced by that child. A node with two children takes the value of its **successor**, the smallest value in its right subtree, and that successor is then removed from where it was.

```python
class Node:
    def __init__(self, value, left=None, right=None):
        self.value, self.left, self.right = value, left, right

def remove(node, value):
    if node is None:
        return None
    if value < node.value:
        node.left = remove(node.left, value)
    elif value > node.value:
        node.right = remove(node.right, value)
    elif node.left is None:
        return node.right
    elif node.right is None:
        return node.left
    else:
        successor = node.right
        while successor.left:
            successor = successor.left
        node.value = successor.value
        node.right = remove(node.right, successor.value)
    return node

def inorder(n):
    return [] if n is None else inorder(n.left) + [n.value] + inorder(n.right)

root = Node(50, Node(30), Node(70, Node(60), Node(80)))
print(root.value, inorder(remove(root, 50)), root.value)
```

```text
50 [30, 60, 70, 80] 60
```

## Try it

Checking only each node's immediate children is a classic mistake. The tree below passes that weak check, yet 60 sits in the left subtree of 50. Pass an allowed range down instead.

```python
class Node:
    def __init__(self, value, left=None, right=None):
        self.value, self.left, self.right = value, left, right

def is_bst(node, low=float("-inf"), high=float("inf")):
    if node is None:
        return True
    if not low < node.value < high:
        return False
    return is_bst(node.left, low, node.value) and is_bst(node.right, node.value, high)

print(is_bst(Node(50, Node(30, None, Node(60)), Node(70))))
print(is_bst(Node(50, Node(30, None, Node(40)), Node(70))))
```

```text
False
True
```

## Summary

- Everything left of a node is smaller and everything right of it is larger, across the whole subtree.
- Operations cost the height, which is log n only when the tree stays balanced.
- Prefer a hash table for exact lookup, and an ordered tree when order or ranges matter.

:::quiz ca-binary-search-trees
