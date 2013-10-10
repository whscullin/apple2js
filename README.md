apple2js
========

An Apple II emulator written in Javascript

Things are a little rought around the edges right now, hopefully I will have
time to clean things up in a bit.

Expects compiler.jar from https://developers.google.com/closure/compiler/ to
be in $(HOME)/bin

To build, run "make"

To add additional disk images, use scripts/dsk2json.pl, then "make index"
