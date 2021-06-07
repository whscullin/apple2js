import JSCPU6502 from './impl/jscpu6502';
import TSCPU6502 from './impl/tscpu6502';
import TSCPU6502v2 from './impl/tscpu6502v2';
import TSCPU6502v5 from './impl/tscpu6502v5';
import TSCPU6502v6 from './impl/tscpu6502v6';
import Test6502 from './test6502rom';
import Test65C02 from './test65c02rom';

let cpu;
let memory;
let done;
let lastPC;
let callbacks = 0;

function traceCB() {
  let pc = cpu.getPC();
  done = (lastPC == pc) || (pc < 0x100);
  lastPC = pc;
  callbacks++;
}

function setup6502(cpuType) {
  cpu = new cpuType();
  memory = new Test6502();
  cpu.addPageHandler(memory);
}

function setup65C02(cpuType) {
  cpu = new cpuType({ '65C02': true });
  memory = new Test65C02();
  cpu.addPageHandler(memory);
}

function runCPU(stopPC, maxCallbacks) {
  done = false;
  lastPC = 0x0000;
  callbacks = 0;
  cpu.reset();
  memory.reset();
  cpu.setPC(0x400);

  do {
    cpu.stepCyclesDebug(1000, traceCB);
  } while (!done && callbacks <= maxCallbacks);
  if (cpu.getPC() < 0x100) {
    console.log('PC in zero page');
  }
  if (cpu.getPC() != stopPC) {
    console.log(`stop PC incorrect: ${cpu.getPC().toString(16)} != ${stopPC.toString(16)}`);
  }
  if (callbacks > maxCallbacks) {
    console.log('too many callbacks');
  }
}

const tests = [
  {
    impl: 'cpu6502.js',
    emul: '6502',
    setup: () => setup6502(JSCPU6502),
    test: () => runCPU(0x3469, 30648245),
  },
  {
    impl: 'cpu6502.js',
    emul: '65C02',
    setup: () => setup65C02(JSCPU6502),
    test: () => runCPU(0x24f1, 21987280),
  },
  {
    impl: 'cpu6502.ts',
    emul: '6502',
    setup: () => setup6502(TSCPU6502),
    test: () => runCPU(0x3469, 30648245),
  },
  {
    impl: 'cpu6502.ts',
    emul: '65C02',
    setup: () => setup65C02(TSCPU6502),
    test: () => runCPU(0x24f1, 21987280),
  },
  {
    impl: 'cpu6502v2.ts',
    emul: '6502',
    setup: () => setup6502(TSCPU6502v2),
    test: () => runCPU(0x3469, 30648245),
  },
  {
    impl: 'cpu6502v2.ts',
    emul: '65C02',
    setup: () => setup65C02(TSCPU6502v2),
    test: () => runCPU(0x24f1, 21987280),
  },
  {
    impl: 'cpu6502v5.ts',
    emul: '6502',
    setup: () => setup6502(TSCPU6502v5),
    test: () => runCPU(0x3469, 30648245),
  },
  // {
  //   impl: 'cpu6502v5.ts',
  //   emul: '6502',
  //   setup: () => setup65C02(TSCPU6502v5),
  //   test: () => runCPU(0x24f1, 21987280),
  // },
  {
    impl: 'cpu6502v6.ts',
    emul: '6502',
    setup: () => setup6502(TSCPU6502v6),
    test: () => runCPU(0x3469, 30648245),
  },
  {
    impl: 'cpu6502v6.ts',
    emul: '65C02',
    setup: () => setup65C02(TSCPU6502v6),
    test: () => runCPU(0x24f1, 21987280),
  },
];

const IMPLS = [...new Set(tests.map((e) => e.impl))];


const RUNS = 50;
const WARMUP = 10;

function pause() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function round(x, n) {
  return Math.round(x * Math.pow(10, n)) / Math.pow(10, n);
}

function shuffle(/** @type Array<*> */ a) {
  for (let i = a.length - 1; i > 1; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    if (j !== i) {
      let t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
  }
}

function ensureSibling(
    /** @type Element */ e,
    /** @type function(): Element */ f) {
  if (!e.nextElementSibling) {
    e.parentElement.appendChild(f());
  }
  return e.nextElementSibling;
}

function clearSiblings(/** @type Element */ e) {
  while (e.nextElementSibling) {
    e.parentElement.removeChild(e.nextElementSibling);
  }
}

function expandTable(
    /** @type Element */ e,
    /** @type string */ name,
    /** @type number */ i) {
  e = ensureSibling(e, () => document.createElement("td"));
  e.setAttribute("id", name + "_" + i + "_6502");
  e = ensureSibling(e, () => document.createElement("td"));
  e.setAttribute("id", name + "_" + i + "_65C02");
  return e;
}

function buildTable() {
  let table = document.getElementById("benchmarks");
  let implElement = document.getElementById("impl").firstElementChild;
  let emulElement = document.getElementById("emul").firstElementChild;
  let minElement = document.getElementById("min").firstElementChild;
  let maxElement = document.getElementById("max").firstElementChild;
  let meanElement = document.getElementById("mean").firstElementChild;
  let medianElement = document.getElementById("median").firstElementChild;
  let runsElement = document.getElementById("runs").firstElementChild;

  for (let i = 0; i < IMPLS.length; i++) {
    let impl = IMPLS[i];
    implElement = ensureSibling(implElement, () => document.createElement("th"));
    implElement.setAttribute("colspan", "2");
    implElement.innerText = impl;

    emulElement = ensureSibling(emulElement, () => document.createElement("th"));
    emulElement.innerText = "6502";
    emulElement = ensureSibling(emulElement, () => document.createElement("th"));
    emulElement.innerText = "65C02";

    minElement = expandTable(minElement, "min", i);
    maxElement = expandTable(maxElement, "max", i);
    meanElement = expandTable(meanElement, "mean", i);
    medianElement = expandTable(medianElement, "median", i);
    runsElement = expandTable(runsElement, "runs", i);
  }
  clearSiblings(implElement);
}

function name(test) {
  return test.impl + " " + test.emul;
}

export async function benchmark() {
  console.log('benchmark');
  buildTable();
  console.log('table built');
  await pause();
  let stats = {};
  for (let i = 0; i < tests.length; i++) {
    console.log('setting up', name(tests[i]));
    tests[i].setup();
    console.log('starting warmup of', name(tests[i]));
    for (let w = 0; w < WARMUP; w++) {
      tests[i].test();
      await pause();
    }
    console.log('running ', name(tests[i]));
    let runs = [];
    for (let r = 0; r < RUNS; r++) {
      let start = performance.now();
      tests[i].test();
      let end = performance.now();
      let delta = round(end - start, 2);
      runs.push(delta);
      runs.sort((a, b) => a - b);
      let id = IMPLS.indexOf(tests[i].impl) + "_" + tests[i].emul;
      document.getElementById('min_' + id).innerText = runs[0];
      document.getElementById('max_' + id).innerText = runs[runs.length - 1];
      document.getElementById('median_' + id).innerText = runs[Math.floor(runs.length / 2)];
      document.getElementById('mean_' + id).innerText = round(runs.reduce((a, b) => (a + b)) / runs.length, 2);
      document.getElementById('runs_' + id).innerText = runs.length;
      await pause();
    }
    console.log(`${name(tests[i])} runs = `, runs);
  }
}

window.benchmark = benchmark;
