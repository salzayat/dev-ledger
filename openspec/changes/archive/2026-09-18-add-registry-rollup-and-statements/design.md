# Design: Add Registry Rollup And Statements

## Sum the same keys

Every repository's signals are keyed the same way, so the rollup is a fold over them: spec to spec, class
to class, operator to operator. Reported and allocated stay in separate columns, hours stay hours, and each
row names the repositories it came from. With one repository the section is not shown, because it would
repeat the page above it.

## A statement is rows, scoped honestly

A month has two kinds of fact: the period's allocation and the period's hours are monthly; spend by class
and by spec, and velocity, are over the measured window, because a class or a spec has no month. Each row
says which, so a spreadsheet never adds a window figure to a monthly one by accident.
