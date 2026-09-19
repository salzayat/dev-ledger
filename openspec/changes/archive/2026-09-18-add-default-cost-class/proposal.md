# Add Default Cost Class

## Why

Eleven records on this repository's Ledger read `unclassified`, $34.37 and 7.5 hours of it. Seven cite specs
created after the specs were declared, because nothing declares a new spec's class. Four cite no spec at all.
Declaring each spec by hand fixes today and breaks with the next spec.

## What Changes

- A repository may declare a default class, `telemetry class set --default <class>`, applied after the
  session's class, the change's trailer, and the spec's declaration. It is shown as its own source on the
  class panel. Nothing is inferred: a repository with no default keeps `unclassified`.
- This repository declares `rd` as its default; specs can still be declared `production` individually.
