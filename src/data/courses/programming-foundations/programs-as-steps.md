## A computer follows instructions, in order

A program is a list of instructions run one at a time, top to bottom. The computer does not guess what you meant, and it does not skip a line because it looks wrong. Most early confusion comes from imagining the machine understands the goal. It only ever sees the next line.

```python
price = 40
quantity = 3
total = price * quantity
print(total)
```

```text
120
```

Read those lines as a recipe. Line one stores 40 under the name `price`. Line two stores 3. Line three multiplies them and stores the result. Line four shows it. Move `print(total)` to the top and the program stops with an error, because `total` does not exist yet when that line runs.

## Solve it before you code it

Beginners often open an editor first and think second. Reverse that. Almost every small program can be worked out with four questions:

1. What do I have? (the input)
2. What do I want? (the output)
3. How would I do this by hand, on paper, for one small example?
4. Which of those hand steps repeat, and which decide something?

Take a real task: a shop gives 10% off any order of 500 rupees or more. What does a customer pay?

The input is the order amount. The output is the amount to pay. By hand, for an order of 600: is 600 at least 500? Yes, so take off 60 and charge 540. For an order of 200: no discount, charge 200. There is one decision and no repetition. Only now is it worth writing code.

```python
order = 600
if order >= 500:
    pay = order - order * 10 // 100
else:
    pay = order
print(pay)
```

```text
540
```

You will meet `if` properly in a later lesson. The point here is that the code is the paper version, written down exactly.

> [!tip] Trace before you run
> Tracing means walking through code with a pencil, writing each name's current value after every line. It is slow for one minute and saves an hour later. Professionals still do it when code surprises them.

## Tracing a small program

Here is a short program and its trace. Each row shows the state after that line has run.

```python
a = 5
b = a + 2
a = b * 2
print(a, b)
```

```text
14 7
```

| After line | a | b |
|---|---|---|
| `a = 5` | 5 | not yet |
| `b = a + 2` | 5 | 7 |
| `a = b * 2` | 14 | 7 |

Notice that `b` stayed 7 when `a` changed. The third line did not reach back and alter anything. A line runs once, then the program moves on.

## Try it

Before reading the output, work out on paper what this prints.

```python
x = 3
y = x
x = x + 1
y = y + x
print(x, y)
```

```text
4 7
```

If you got `4 7`, your mental model already matches the machine. If not, trace it line by line and find the row where you and the computer disagreed. That row is the thing to learn.

## Summary

- A program runs one line at a time, and nothing happens unless a line makes it happen.
- Work out inputs, outputs and hand steps before writing code.
- Tracing on paper is how you find out what code really does.

:::quiz pf-programs-as-steps
