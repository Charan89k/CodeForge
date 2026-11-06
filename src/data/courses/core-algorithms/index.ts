import type { CourseSource } from "../index";
import { choice } from "../quiz";

export const CORE_ALGORITHMS: CourseSource = {
  slug: "core-algorithms",
  quizPrefix: "ca",
  title: "Core Algorithms",
  subtitle: "Trees, heaps, graphs, sorting, greedy choices and dynamic programming",
  description:
    "The structures and techniques that follow arrays and hashing. You will build trees and heaps, walk graphs, find shortest paths and spanning trees, see how sorting works, learn to prove a greedy choice, and approach dynamic programming with a method rather than by memorising solutions. Every example in the course is run automatically, so the outputs you read are the real ones.",
  category: "Data Structures & Algorithms",
  level: "INTERMEDIATE",
  outcomes: [
    "Write tree traversals and binary search tree operations from first principles",
    "Use heaps for priority queues, top-k and merging",
    "Choose between BFS, DFS, Dijkstra and Kruskal, and say why",
    "Compare sorting algorithms by time, space and stability",
    "Test a greedy idea with counterexamples and an exchange argument",
    "Solve dynamic programming problems by defining the state first",
  ],
  prerequisites: [
    "Comfortable with Python functions, lists and dictionaries",
    "Basic recursion and big O notation",
  ],
  sections: [
    {
      slug: "trees-and-heaps",
      title: "Trees and heaps",
      summary:
        "Hierarchical data, sorted trees, and always knowing the most urgent item.",
      lessons: [
        {
          slug: "trees-and-traversal",
          title: "Trees and traversal",
          summary:
            "Model hierarchy with trees, write recursive tree code, and visit nodes in four useful orders.",
          difficulty: "EASY",
          objectives: [
            "Use the terms root, leaf, parent, child and height",
            "Write recursive functions over a binary tree",
            "Produce preorder, inorder, postorder and level-order traversals",
          ],
          keyTakeaways: [
            "Handle empty, solve the children, combine",
            "Traversal orders differ in when the node is handled",
            "Level order uses a queue",
          ],
          questions: [
            choice(
              "What is the inorder traversal of a root 2 with left child 1 and right child 3?",
              "1 2 3",
              ["2 1 3", "1 3 2", "3 2 1"],
              "Inorder visits the left subtree, then the node, then the right subtree."
            ),
            choice(
              "What does this return for a single node with no children?",
              "0",
              ["1", "-1", "It stops with an error"],
              "The node adds 1 to the larger of its children's heights, each -1, giving 0.",
              "def height(node):\n    if node is None:\n        return -1\n    return 1 + max(height(node.left), height(node.right))"
            ),
            choice(
              "Which traversal suits adding up folder sizes, where a folder needs its contents' totals first?",
              "Postorder",
              ["Preorder", "Inorder", "Level order"],
              "Postorder handles the children before the node, so their totals are ready."
            ),
          ],
        },
        {
          slug: "binary-search-trees",
          title: "Binary search trees",
          summary:
            "Keep values searchable and changeable, and see why the tree's shape decides its speed.",
          difficulty: "MEDIUM",
          objectives: [
            "State the binary search tree rule precisely",
            "Search, insert and remove values",
            "Explain when a BST beats a hash table",
          ],
          keyTakeaways: [
            "The rule covers whole subtrees, not just children",
            "Cost equals height, which needs balance to stay small",
            "Inorder traversal gives sorted output",
          ],
          questions: [
            choice(
              "Inserting 1, 2, 3, 4, 5 in that order into an empty BST gives what height?",
              "4",
              ["2", "3", "5"],
              "Sorted input builds a chain, one node per level, so height is n - 1."
            ),
            choice(
              "Why is checking only that each node's children are in order not enough?",
              "A deeper value can still break the rule for an ancestor",
              [
                "Children are not compared in a BST",
                "It would take too long",
                "A BST may hold duplicate roots",
              ],
              "The rule applies to the whole subtree, so pass a permitted range down."
            ),
            choice(
              "You need the nearest value below x, repeatedly, with inserts. What fits best?",
              "A balanced search tree",
              ["A hash table", "An unsorted list", "A stack"],
              "Order is what hashing gives up, and a balanced tree finds neighbours in O(log n)."
            ),
          ],
        },
        {
          slug: "heaps-and-priority-queues",
          title: "Heaps and priority queues",
          summary:
            "Add items and remove the most urgent in O(log n), and use that for top-k and merging.",
          difficulty: "MEDIUM",
          objectives: [
            "Explain the heap rule and its array layout",
            "Use heapq, including for a max-heap",
            "Apply the top-k pattern",
          ],
          keyTakeaways: [
            "The root is the smallest, but a heap is not sorted",
            "Top k uses a min-heap of size k",
            "Tuples order by first element, so mind ties",
          ],
          questions: [
            choice(
              "In a min-heap's array, where is the left child of the node at index 3?",
              "7",
              ["4", "6", "8"],
              "The left child is at 2*i + 1, and 2*3 + 1 is 7."
            ),
            choice(
              "To keep the 10 largest of a million values, what should you use?",
              "A min-heap of size 10",
              [
                "A max-heap of a million",
                "A sort of everything",
                "A min-heap of a million",
              ],
              "Its root is the weakest of the current top 10, so it is the one to replace."
            ),
            choice(
              "Is the array [1, 5, 2, 9, 6] a valid min-heap?",
              "Yes, every parent is no larger than its children",
              [
                "No, it is not sorted",
                "No, 5 is larger than 2",
                "No, 9 should come before 6",
              ],
              "Siblings have no required order, so a heap need not be sorted."
            ),
          ],
        },
      ],
    },
    {
      slug: "graphs",
      title: "Graphs",
      summary: "Connections of any shape, and the routes through them.",
      lessons: [
        {
          slug: "graphs-and-traversal",
          title: "Graphs, BFS and DFS",
          summary:
            "Store graphs, explore them breadth-first and depth-first, treat grids as graphs, and order by dependency.",
          difficulty: "MEDIUM",
          objectives: [
            "Choose between an adjacency list and a matrix",
            "Write BFS and DFS, and pick the right one",
            "Produce a topological order and detect a cycle",
          ],
          keyTakeaways: [
            "Mark a vertex seen when you first reach it",
            "BFS finds shortest paths only when edges cost the same",
            "Both traversals cost O(V + E)",
          ],
          questions: [
            choice(
              "Find the fewest moves through a maze where every step costs the same. What fits?",
              "BFS",
              ["DFS", "Kruskal", "A sort"],
              "BFS reaches each cell by the fewest steps first."
            ),
            choice(
              "Why mark a vertex as seen when adding it to the BFS queue, not when removing it?",
              "Otherwise it can be queued many times",
              [
                "Removing it is not possible",
                "BFS would become DFS",
                "It would use less memory otherwise",
              ],
              "Between being queued and being removed, other neighbours could add it again."
            ),
            choice(
              "A topological sort processes only 3 of 5 tasks. What does that mean?",
              "The dependencies contain a cycle",
              [
                "Two tasks are disconnected",
                "The queue was too small",
                "The graph is undirected",
              ],
              "Tasks in a cycle always wait on each other, so they never become ready."
            ),
          ],
        },
        {
          slug: "shortest-paths-and-spanning-trees",
          title: "Shortest paths and spanning trees",
          summary:
            "Find the cheapest route with Dijkstra, track groups with union-find, and connect everything with Kruskal.",
          difficulty: "HARD",
          objectives: [
            "Implement Dijkstra with a heap, and know when it fails",
            "Use disjoint set union to track groups",
            "Build a minimum spanning tree with Kruskal",
          ],
          keyTakeaways: [
            "Dijkstra needs non-negative edge costs",
            "Union-find detects cycles in nearly constant time",
            "A spanning tree minimises the whole network, not one route",
          ],
          questions: [
            choice(
              "Why can Dijkstra give wrong answers with negative edges?",
              "A settled vertex could later be improved by a route through a negative edge",
              [
                "Heaps cannot store negative numbers",
                "The queue runs out of space",
                "Negative edges make the graph undirected",
              ],
              "Settling assumes no later route can be cheaper, which negative edges break."
            ),
            choice(
              "In Kruskal's algorithm, how do you know an edge would form a cycle?",
              "Its two ends are already in the same group",
              [
                "Its cost is above average",
                "One end has no edges yet",
                "It was added to the heap twice",
              ],
              "A second path between vertices already connected closes a loop."
            ),
            choice(
              "You must connect all offices at the least total cable cost. What are you finding?",
              "A minimum spanning tree",
              [
                "Shortest paths from one office",
                "A topological order",
                "A level-order traversal",
              ],
              "It minimises the total network, which is not the same as any single route."
            ),
          ],
        },
      ],
    },
    {
      slug: "sorting-and-greedy",
      title: "Sorting and greedy choices",
      summary: "How order is produced, and how to know when a simple rule is enough.",
      lessons: [
        {
          slug: "sorting",
          title: "Sorting algorithms",
          summary:
            "Compare insertion, merge, quick and counting sort by time, space and stability.",
          difficulty: "MEDIUM",
          objectives: [
            "Write insertion sort, merge sort and quicksort",
            "Compare sorts by time, space and stability",
            "Explain the n log n lower bound and how counting sort avoids it",
          ],
          keyTakeaways: [
            "Merge sort is always O(n log n), at the cost of extra space",
            "Pivot choice decides quicksort's worst case",
            "Stable sorts let you sort by several keys in turn",
          ],
          questions: [
            choice(
              "What is the worst-case time of merge sort?",
              "O(n log n)",
              ["O(n)", "O(n²)", "O(log n)"],
              "It always splits in half and merges in linear time, whatever the input."
            ),
            choice(
              "A quicksort always picks the last item as pivot. What input hurts it most?",
              "Already sorted input",
              ["Random input", "All different values", "Very short input"],
              "Each pivot is the largest, so partitions remove just one item, giving O(n²)."
            ),
            choice(
              "Why does sorting by date and then stably by customer keep each customer's orders in date order?",
              "A stable sort keeps equal items in their existing order",
              [
                "Customers are compared by date",
                "Every sort preserves earlier sorts",
                "Sorting twice undoes the first sort",
              ],
              "Items with the same customer are equal for this sort, so their date order stays."
            ),
          ],
        },
        {
          slug: "greedy-choices",
          title: "Greedy choices",
          summary:
            "Commit to the best-looking step, attack the idea with counterexamples, and prove it with an exchange argument.",
          difficulty: "MEDIUM",
          objectives: [
            "Write greedy solutions by sorting on the key insight",
            "Break wrong greedy rules with counterexamples",
            "Use an exchange argument to justify a rule",
          ],
          keyTakeaways: [
            "Greedy can be plausible and wrong",
            "Attack an idea before trusting it",
            "Earliest finish is the safe scheduling rule",
          ],
          questions: [
            choice(
              "With coins 1, 3 and 4, how many coins does largest-first use to make 6?",
              "3",
              ["2", "4", "6"],
              "It takes 4, 1, 1. The best answer is 3 + 3, which is why greed fails here."
            ),
            choice(
              "To fit the most meetings in one room, which do you choose first?",
              "The one that finishes earliest",
              [
                "The shortest",
                "The one that starts earliest",
                "The one with the fewest conflicts in the morning",
              ],
              "It leaves the room free soonest, and an exchange argument proves it safe."
            ),
            choice(
              "What does an exchange argument show?",
              "Any best answer can be changed to include the greedy choice without getting worse",
              [
                "The greedy algorithm runs faster than others",
                "Every input has one unique answer",
                "Sorting is always necessary",
              ],
              "If a best answer can always include your choice, that choice is safe."
            ),
          ],
        },
      ],
    },
    {
      slug: "dynamic-programming",
      title: "Dynamic programming",
      summary: "Reuse answers to smaller problems, with a method you can repeat.",
      lessons: [
        {
          slug: "dynamic-programming-basics",
          title: "Dynamic programming basics",
          summary:
            "Save repeated work with memoization or tabulation, and follow four steps from state to answer.",
          difficulty: "MEDIUM",
          objectives: [
            "Recognise overlapping subproblems and optimal substructure",
            "Write memoized and tabulated solutions",
            "Define a state and recurrence for a new problem",
          ],
          keyTakeaways: [
            "Define the state in one plain sentence first",
            "Think about the last decision made",
            "Without overlap, it is plain divide and conquer",
          ],
          questions: [
            choice(
              "What makes plain recursive Fibonacci slow?",
              "It solves the same subproblems again and again",
              [
                "Recursion is always slow",
                "Adding numbers is expensive",
                "It uses too many variables",
              ],
              "Saving each answer once brings it from exponential to linear time."
            ),
            choice(
              "Merge sort splits a problem and combines answers. Why is it not dynamic programming?",
              "Its subproblems do not overlap",
              [
                "It has no recursion",
                "It uses extra memory",
                "It does not produce one answer",
              ],
              "Each half is different work, so there is nothing to save."
            ),
            choice(
              "For fewest coins, what does dp[a] mean?",
              "The fewest coins that make the amount a",
              [
                "The value of coin a",
                "How many coins exist below a",
                "Whether coin a was used",
              ],
              "A state you can say in one sentence makes the recurrence follow naturally."
            ),
          ],
        },
        {
          slug: "dynamic-programming-patterns",
          title: "Dynamic programming patterns",
          summary:
            "Recognise the common shapes: one sequence, two sequences, knapsack and grid.",
          difficulty: "HARD",
          objectives: [
            "Pick a state shape for a new problem",
            "Solve longest increasing and common subsequence",
            "Write a 0/1 knapsack and reduce its space",
          ],
          keyTakeaways: [
            "Most problems use a few repeated shapes",
            "Ending exactly at i lets a sequence be extended",
            "Run the knapsack's capacity loop downward",
          ],
          questions: [
            choice(
              "For longest increasing subsequence with dp[i] ending at i, where is the answer?",
              "The largest value anywhere in dp",
              ["dp at the last index", "dp at index 0", "The sum of dp"],
              "The best subsequence can end at any position."
            ),
            choice(
              "In a one-row 0/1 knapsack, what goes wrong if capacity runs upward?",
              "An item can be used more than once",
              [
                "The result is always zero",
                "It raises an index error",
                "Heavier items are skipped",
              ],
              "dp[c - weight] may already include this item, which is the unbounded version."
            ),
            choice(
              "Comparing two strings by their prefixes uses which state shape?",
              "Two sequences, with dp[i][j]",
              ["One sequence", "Knapsack", "Topological order"],
              "The state tracks how far you are through each string."
            ),
          ],
        },
      ],
    },
  ],
};
