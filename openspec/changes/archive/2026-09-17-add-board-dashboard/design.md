# Design: Add Board Dashboard

## A static page, because the projection is already the data

The projection is canonical JSON that any machine rebuilds byte-identically. A dashboard that needed a
server would put a process between the engineer and that file for no gain. The page is rendered from the
projection by the same package that built it, written next to it, and opened from a file URL. No script
runs on it, so nothing on the page can compute a figure the projection does not already hold, which is
what keeps "every figure cites its inputs" true of the page as well as of the data.

## Same panels as the terminal render, same rules

The HTML render and the terminal render read the same `RepositorySignals`; the page adds layout, not
figures. Each panel shows its headline number, its trust classes, its excluded count in the same line
rather than in a tooltip, and a collapsed list of citations underneath. A refusal or an absence renders
as the panel's content, never as a zero.

## Inline SVG bars for distributions

Cycle time and wait time are p50, p90, and max over the changes that had a pull head ref. Three horizontal
bars scaled to the max say what a table of seconds does not. The bars are inline SVG with the numbers
written beside them, so the page is readable when the graphics are not.

## Light, dark, and narrow

Colors are CSS variables on the root with a `prefers-color-scheme: dark` override; the layout is a grid
that collapses to one column under 720 pixels. Nothing on the page depends on a font or a stylesheet that
is not embedded.
