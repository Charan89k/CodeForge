## When a list is the wrong shape

A folder holds files and other folders. A company has managers with people under them. A web page nests elements inside elements. In each case one thing contains several others, and a flat list hides that structure. A **tree** keeps it.

A tree has a **root** at the top. Every other node has exactly one **parent** and any number of **children**. A node with no children is a **leaf**. The **height** is the number of edges on the longest path from the root down to a leaf. In a **binary tree**, each node has at most two children, called left and right.

```python
class Node:
    def __init__(self, value, left=None, right=None):
        self.value = value
        self.left = left
        self.right = right

root = Node(1, Node(2, Node(4), Node(5)), Node(3))
print(root.left.right.value)
```

```text
5
```

That builds this tree, with 1 at the root, 2 and 3 below it, and 4 and 5 below 2:

```text
    1
   / \
  2   3
 / \
4   5
```

## Recursion fits trees

A tree is defined in terms of itself: a node, plus a left tree, plus a right tree. So most tree code has the same three-part shape. Handle the empty tree, solve both children, combine the answers.

```python
class Node:
    def __init__(self, value, left=None, right=None):
        self.value, self.left, self.right = value, left, right

def height(node):
    if node is None:
        return -1
    return 1 + max(height(node.left), height(node.right))

def total(node):
    if node is None:
        return 0
    return node.value + total(node.left) + total(node.right)

root = Node(1, Node(2, Node(4), Node(5)), Node(3))
print(height(root), total(root))
```

```text
2 15
```

Each node is visited once, so both take O(n) time. The space used is the depth of the recursion, which is the height of the tree.

## Four orders of visiting

Traversal means visiting every node. The three depth-first orders differ only in when you handle the node itself.

| Order | Sequence | Typical use |
|---|---|---|
| Preorder | node, left, right | Copying a tree; printing a folder listing |
| Inorder | left, node, right | Reading a binary search tree in sorted order |
| Postorder | left, right, node | Deleting; adding up folder sizes |
| Level order | one level at a time | Finding the nearest node to the root |

```python
from collections import deque

class Node:
    def __init__(self, value, left=None, right=None):
        self.value, self.left, self.right = value, left, right

def preorder(n):
    return [] if n is None else [n.value] + preorder(n.left) + preorder(n.right)

def inorder(n):
    return [] if n is None else inorder(n.left) + [n.value] + inorder(n.right)

def postorder(n):
    return [] if n is None else postorder(n.left) + postorder(n.right) + [n.value]

def level_order(root):
    seen, queue = [], deque([root])
    while queue:
        node = queue.popleft()
        if node:
            seen.append(node.value)
            queue.append(node.left)
            queue.append(node.right)
    return seen

root = Node(1, Node(2, Node(4), Node(5)), Node(3))
print(preorder(root))
print(inorder(root))
print(postorder(root))
print(level_order(root))
```

```text
[1, 2, 4, 5, 3]
[4, 2, 5, 1, 3]
[4, 5, 2, 3, 1]
[1, 2, 3, 4, 5]
```

Level order uses a queue. Keep that in mind: the same idea becomes breadth-first search on graphs.

> [!warning] Deep trees and recursion limits
> A badly unbalanced tree can be as deep as it has nodes. Python stops recursion at about 1,000 levels by default, so a long chain raises `RecursionError`. For inputs that deep, use an explicit stack.

## Try it

Write `count_leaves`. A node with no children counts as 1, and any other node is the sum of its children's counts. Then check it against the tree above, which has three leaves.

```python
class Node:
    def __init__(self, value, left=None, right=None):
        self.value, self.left, self.right = value, left, right

def count_leaves(node):
    if node is None:
        return 0
    if node.left is None and node.right is None:
        return 1
    return count_leaves(node.left) + count_leaves(node.right)

print(count_leaves(Node(1, Node(2, Node(4), Node(5)), Node(3))))
```

```text
3
```

## Summary

- A tree has one root, every other node has one parent, and leaves have no children.
- Most tree code is one pattern: handle empty, solve the children, combine.
- Preorder, inorder and postorder differ only in when the node itself is handled. Level order uses a queue.

:::quiz ca-trees-and-traversal
