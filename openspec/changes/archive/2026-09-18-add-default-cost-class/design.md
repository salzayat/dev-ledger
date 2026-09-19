# Design: Add Default Cost Class

A default is a declaration, not an inference: an operator commits it, it is validated against the class
vocabulary, it sits last in the resolution order so every specific declaration wins over it, and the panel
counts the records it classified under the source `default`. That keeps the rule that the tool never
invents a class, while a repository whose work is all one kind states it once.
