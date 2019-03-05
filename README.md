apple2js
========

An Apple II emulator written in Javascript.

Things are still a little rough around the edges right now, hopefully I will have more time to clean things up.

First

```sh
npm install
```

To run a development server

```sh
npm run dev
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
./bin/index`
```
