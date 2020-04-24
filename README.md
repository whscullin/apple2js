# apple2js

## What is this?

Apple \]\[js and Apple //jse are Apple \]\[ and Apple //e emulators written entirely in JavaScript and HTML5.

Things are still a little rough around the edges right now, hopefully I will have more time to clean things up.

First

```sh
npm install
```

To run a development server

```sh
npm start
```

The open either
[http://localhost:8080/apple2js.html](http://localhost:8080/apple2js.html) or
[http://localhost:8080/apple2jse.html](http://localhost:8080/apple2jse.html)

To build a static distribution into `dist`

```sh
npm run build
```

To add additional disk images, use

```sh
./bin/dsk2json -c Category -n Name path/to/image.dsk > json/disks/image.json
```

then

```sh
./bin/index
```

## Updates

### 2019-03-02

* Behind the scenes

    A lot of not so visible changes behind the scenes. The website now runs directly off of github, and has a more modern toolchain (Goodbye make, Perl and closure compiler, hello Webpack!) to facilitate development.

* Performance

    In particular, the screen no longer redraws as quickly as possible.

* Drag and Drop

    Disk images can be dragged into the window to load them.

* Contributions

    Thanks to [Ian Flanigan](https://github.com/iflan) for additions to improve ChromeBook behavior.

### 2017-10-08

* Better iOS support

    Bluetooth keyboards now work better. Reset is Ctrl-Shift-Delete. iOS now allows loading disks from iCloud and services like Drop Box. Saving locally is still not supported by iOS. I now understand why sound doesn't work, and I'm working on a work-around.

* Source Maps

    Although the source code has always been available, by default I serve up minified Javascript for performance reasons. But now you can poke around more easily.

## Updates (2017-08-31)

(It's been a long time since I updated, so this is a rough list)

* Videx Videoterm Emulation (\]\[js)

    PR#3 now does something on the Apple \]\[!.

* AppleColor RGB Card Emulation (//jse)

    Now supports a bunch of the mostly non-standard video formats found on the AppleColor RGB card, including 16 color text, 16 color hires mode, and mixed black and white and color double hires
* Machine selection

    You can now select between original, autostart and plus Apple \]\[s, and unenhanced and enhanced //es.

## Updates (2013-07-04)

* RAMFactor Emulation (//jse)

    I now simulate having a 1 Megabyte RAMFactor card in slot 2.

* Thunderclock Emulation

    There is cursory emulation of the Thunderclock card, enough to keep ProDOS applications from asking you to enter the date all the time. ProDOS attempts to guess the year from the month, the day and the day of the week, something that needs to be patched every 6 years. This means newer versions think it's 1996, older versions are stuck in the 80s.

* Firefox Nightly Joystick Support

    Joystick support has yet to officially land, but the latest nightlies support the gamepad API.

## Updates (2013-03-20)

* Animation Frames

    I've switched from using setInterval() to requestAnimationFrame() where supported. This, in conjunction with the graphics re-write, seems to smooth performance and provide a more stable CPU speed.
* Graphics Re-Write

    This (third) re-write of the graphics system should improve performance with graphics intensive programs. Rather than rendering each graphics update as it happens, updates are rendered each animation frame.

## Updates (2013-03-12)

* Apple //e

    After much flailing, and much staring at MMU emulation code in despair, I've finally published my Apple //e emulator. It's probably a little more rough than I'd hoped, but it has a lot of features that I really wanted to get into it, like basic double hires support, and it uses the enhanced Apple //e ROMs.

## Updates (2013-02-25)

* Joystick Support

    Chrome only so far, the nascent gamepad API has finally allowed me to add basic joystick support. I can now re-live my glory days of Skyfox.

* Re-written CPU emulator

    I finally got around to applying some of the many lessons I learned along the way writing my first CPU emulator in Javascript. The last re-working gave me about a 100% performance gain.

* Finally Fixed Oregon Trail

    This seems to have been a major disappointment for many people. I was able to make it as a banker, but I'm embarassed to reveal my score.

* Competition

    Now in addition to [Gil Megidish's](http://www.megidish.net/apple2js/) Apple2JS, there's a couple of new kids on the block, including [David Caldwell's](http://porkrind.org/a2/) Apple II+ emulator where he's put a lot more thought into the graphics rendering than I have, and [appletoo](https://github.com/nicholasbs/appletoo), which I just stumbled across while looking for David's emulator and haven't had much time to look at.

## Requirements

* A Browser with HTML5 Support

    The most recent versions of [Google Chrome](https://www.google.com/chrome/), [Safari](https://www.apple.com/safari/), [Firefox](https://www.firefox.com/), and [Opera](https//www.opera.com/) all seem to work reasonably well these days,although variations in HTML5 support pop up, and occasionally a major release will move things around out from under me. IE prior to 9 lacks canvas tag support and is unsupported. [IE 9+](https://windows.microsoft.com/ie9) renders nicely on a modern machine.

* Basic Knowledge of the Apple \]\[

    If you don't know how to use an Apple \]\[, this won't be much fun for you.

## Acknowledgements

* I'm using the following libraries:

  * [jQuery](https://jquery.com) and [jQuery UI](https://jqueryui.com)
  * Base64 Utilities via [KvZ](http://kevin.vanzonneveld.net/)
  * LED graphics from [Modern Life](http://modernl.com/).
  * [CFFA2 Firmware](http://dreher.net/?s=projects/CFforAppleII&c=projects/CFforAppleII/downloads1.php) by Chris Schumann, Rich Dreher and Dave Lyons

* I heavily referenced:

  * [_Beneath Apple DOS_](http://www.scribd.com/doc/200679/Beneath-Apple-DOS-By-Don-Worth-and-Pieter-Lechner) by Don Worth and Pieter Lechner
  * _Inside the Apple //e_ by Gary B. Little
  * [_DOS 3.3 Anatomy_](http://apple2.org.za/gswv/a2zine/GS.WorldView/Resources/DOS.3.3.ANATOMY/)
  * [_Apple II Disk Drive Article_](http://www.doc.ic.ac.uk/~ih/doc/stepper/others/example3/diskii_specs.html) by Neil Parker
  * [6502.org](http://6502.org/)
  * The [comp.sys.apple2.programmer](http://www.faqs.org/faqs/apple2/programmerfaq/part1/) FAQ
  * [Understanding the Apple \]\[](https://archive.org/details/understanding_the_apple_ii) and [Understanding the Apple //e](https://archive.org/details/Understanding_the_Apple_IIe) by Jim Sather.
  * [Apple II Colors](https://mrob.com/pub/xapple2/colors.html) by Robert Munafo.

* And special thanks to:

  * [ADTPro](http://adtpro.sourceforge.net/) for allowing me to pull some of my circa 1980 programming efforts off some ancient floppies.
  * [KEGS](http://kegs.sourceforge.net/), because at some point I got so tired of futzing with ADC/SBC code I just ported the KEGS C code for those opcodes to Javascript so I could stop worrying about it.
  * [Apple II History](http://apple2history.org/), for a lovely, informative site.
  * [Gil Megidish](http://www.megidish.net/apple2js/), for the kick in the pants to finally post my version, once I realized there was, in fact, another apple2js in the world.
  * [AppleWin](https://github.com/AppleWin/AppleWin/), whose source code is a goldmine of useful references.
  * [Zellyn Hunter](https://github.com/zellyn/a2audit) and a2audit, for allowing me to get really nitpicky in my memory emulation.

* Contributors
  * [Snapperfish](http://github.com/Snapperfish) Various fixes
