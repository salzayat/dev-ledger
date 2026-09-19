# Add Ship States

## Why

The release rule called every merged change without a tag R&D, then flipped it to production when a tag was
cut. Merged work waiting for a tag is not speculation; it is inventory. The speculation is work no tag will
hold: attempts overwritten before the tag, and pull requests closed without merging. Git can tell the three
apart without anyone judging the work.

## What Changes

- Every measured change and unmerged pull request is `shipped`, `pending`, or `discarded`. Blame at each
  release tag decides whether a carried change left any lines in it.
- An Economics sub-view, Shipped, reports spend and hours by state and what each release kept, and the
  headline says how much work waits for a release.
- The release rule becomes `{ shipped, discarded }`; pending work is its own `pending` class row until the
  next tag resolves it. `class set --release` takes the shipped class, then the discarded class.
