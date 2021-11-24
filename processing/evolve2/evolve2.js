const E = 2.71828;

function sig(x) {
  const ex = pow(E,x);
  return ex / (ex + 1);
}

function tanh(x) {
  const ex = pow(E,x);
  const ex1 = pow(E,-x);
  return (ex - ex1) / (ex + ex1);
}

function mid(a, b, c) {
  return min(max(a, b), c);
}

// Angle functions remapped from 0 to 1, counter clockwise starting from East.
function sin_1(a) {
  return -sin(a * 2 * PI);
}

function cos_1(a) {
  return cos(a * 2 * PI);
}

function atan2_1(dx, dy) {
  // Normalize direction.
  // Make Y negative so up is negative, add PI to fix dumb atan range.
  return (atan2(-dy, dx) + PI) / (2 * PI);
}

function mutationMask(maxMask, rate) {
  var mutate = () => random() < rate;
  var result = 0;
  var mask = 1;
  
  while (mask <= maxMask) {
    if (mutate()) {
      result += mask;
    }
    mask <<= 1;
  }
  
  return result;
}


class Board {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this.reset();
  }
  
  reset() {
    this.board = [];
    this.bugs = [];
    this.pheromones = [];
    this.phmIndex = [];
  }
  
  addBug(b) {
    var ix = this.getIndex(b.pos.x, b.pos.y);
    if (this.board[ix] == undefined) {
      this.bugs.push(b);
      this.board[ix] = b;
    }
  }

  addPheromone(p) {
    var ix = this.getIndex(p.pos.x, p.pos.y);
    if (this.phmIndex[ix] == undefined) {
      this.pheromones.push(p);
      this.phmIndex[ix] = p;
    }
  }

  fadePheromones() {
    for (var i = this.pheromones.length - 1; i >= 0; i--) {
      var p = this.pheromones[i];
      if (!p.fade()) {
        this.phmIndex[this.getIndex(p.pos.x, p.pos.y)] = undefined;
        this.pheromones.splice(i, 1);
      }
    }
  }

  getPheromoneCenter(x, y, r) {
    var sx = 0;
    var sy = 0;
    var cnt = 0;

    this.iterItems(x, y, r, this.phmIndex, (p) => {
      if (p != undefined) {
        sx += p.pos.x * p.level;
        sy += p.pos.y * p.level;
        cnt += p.level;
      }
    });

    if (cnt > 0) {
      return {x: round(sx / cnt), y: round(sy / cnt)};
    }

    return undefined;
  }
  
  getCell(x, y) {
    return this.board[this.getIndex(x, y)];
  }
  
  setCell(x, y, o) {
    this.board[this.getIndex(x, y)] = o;
  }
  
  getIndex(x, y) {
    return y * this.width + x;
  }
  
  getCoord(index) {
    return {x: index % this.width, y: int(index / this.width)};
  }
  
  neighborCount(x, y, r) {
    let count = 0;
    let total = 0;
    
    this.iterItems(x, y, r, this.board, (b) => {
     if (b != undefined) {
       count++;
     }
     total++;
    });
    
    return [count, total];
  }

  getNeighborCenter(x, y, r) {
    var sx = 0;
    var sy = 0;
    var cnt = 0;

    this.iterItems(x, y, r, this.board, (b) => {
      if (b != undefined) {
        sx += b.pos.x;
        sy += b.pos.y;
        cnt++;
      }
    });

    if (cnt > 0) {
      return {x: round(sx / cnt), y: round(sy / cnt)};
    }

    return undefined;
  }
  
  iterItems(x, y, r, table, fn) {
    var min_x = max(x - r, 0);
    var max_x = min(x + r, this.width - 1);
    var min_y = max(y - r, 0);
    var max_y = min(y + r, this.height - 1);

    for (var _y = min_y; _y <= max_y; _y++) {
      for (var _x = min_x; _x <= max_x; _x++) {
        if (dist(x, y, _x, _y) <= r) {
          fn(table[this.getIndex(_x, _y)]);
        }
      }
    }
  }

  // Gets the coord of a move in dir (0..1)
  // 0=E, 1=NE, 2=N, 3=NW, 4=W, 5=SW, 6=S, 7=SE
  getNextCoord(x, y, dir) {
    var [nx, ny] = [x, y];
    var d = round(8 * dir) % 8;

    switch (d) {
      case 0:
        nx += 1;
        break;
      case 1:
        nx += 1;
        ny -= 1;
        break;
      case 2:
        ny -= 1;
        break;
      case 3:
        nx -= 1;
        ny -= 1;
        break;
      case 4:
        nx -= 1;
        break;
      case 5:
        nx -= 1;
        ny += 1;
        break;
      case 6:
        ny += 1;
        break;
      case 7:
        nx += 1;
        ny += 1;
        break;
      default:
        console.log("Bad Direction", dir);
    }
    
    nx = mid(0, nx, board.width - 1);
    ny = mid(0, ny, board.height - 1);
    return [nx, ny];
  }

  isBlocked(x, y, dir) {
    var [nx, ny] = this.getNextCoord(x, y, dir);
    return this.getCell(nx, ny) != undefined;
  }

  move(x, y, dir) {
    var [nx, ny] = this.getNextCoord(x, y, dir);
    
    const src = this.getCell(x, y);
    const dest = this.getCell(nx, ny);
    
    // TODO: empty test?
    if (dest == undefined) {
      this.setCell(nx, ny, src);
      this.setCell(x, y, undefined);
      return {x: nx, y: ny};
    } else {
      return {x: x, y: y};
    }
  }
}


class Genome {
  constructor() {
    this.genes = [];
    this.clr = undefined;
    this.id = undefined;
  }
  
  randomize(n) {
    for (var i = 0; i < n; i++) {
      this.genes.push(floor(random(0x10000)));
    }
  }
  
  get identity() {
    if (this.id == undefined) {
      for (var i = 0; i < this.genes.length; i++) {
        this.id = this.id ^ (this.genes[i] << (i % 1));
      }
    }
    
    return this.id;
  }
  
  get color() {
    if (this.clr == undefined) {
      const r = (this.identity) & 0xff;
      const g = (this.identity >> 8) & 0xff;
      const b = (this.identity >> 16) & 0xff;
      this.clr = color(r, g, b);
    }
    
    return this.clr;
  }
  
  mutateFrom(g) {
    g.genes.forEach(g => {
      const mutation = mutationMask(0xff, mutationRate);
      this.genes.push(g ^ mutation);
    });
  }
}


class Neuron {
  constructor(name) {
    this.inputs = [];
    this.name = name;
  }
  
  addInput(n, w) {
    if (n == this) {
      console.log("SKIP SELF INPUT");
      return;
    }
    
    this.inputs.push({
      neuron: n,
      weight: w
    });
    
    //console.log("Added connection: " + n.name + " -> " + this.name + " " + w);
  }
  
  getLevel() {    
    var total = 0;
    this.inputs.forEach(i => total += i.neuron.getLevel() * i.weight);
    return tanh(total);
  }
  
  dump() {
    var result = "";
    
    if (this.inputs.length == 0) {
      return result;
    }
    
    this.inputs.forEach(x => {
      /*
      // Recursive dump
      result += x.neuron.dump();
      */
      result += x.neuron.name + "=(" + x.weight + ")=>" + this.name + "\n";
    });
    
    return result;
  }
}

class InputNeuron extends Neuron {
  constructor(name, input) {
    super(name);
    this.input = input;
  }
  
  getLevel() {
    return this.input();
  }
}

class OutputNeuron extends Neuron {
  constructor(name, action) {
    super(name);
    this.action = action;
  }
  
  activate() {
    this.action(this.getLevel());
  }
}


// TOOD: lots of expensive closures.
class Brain {
  constructor(b) {
    var oscOffset = floor(random(30));
    this.inputs = [
      new InputNeuron("FWDIR", () => b.dir),
      new InputNeuron("BLCKD", () => b.isBlocked),
      new InputNeuron("NBCNT", () => norm(b.neighborCount, 0, 8)),
      //new InputNeuron("SAFTY", () => b.safety),
      new InputNeuron("FWSAF", () => b.isSafeAhead),
      new InputNeuron("NBDIR", () => b.neighborDir),
      new InputNeuron("RANDM", () => random()),
      new InputNeuron("OSCLR", () => norm((iteration + oscOffset) % 30, 0, 30)),
      new InputNeuron("PHDIR", () => b.pheromoneDir),
      new InputNeuron("_AGE_", () => b.age),
      new InputNeuron("HUNGR", () => b.hunger),
      //new InputNeuron("X_POS", () => b.posX),
      //new InputNeuron("Y_POS", () => b.posY),
    ];

    this.outputs = [
      new OutputNeuron("MVFWD", x => b.moveForward(x)),
      new OutputNeuron("MVBWD", x => b.moveBackward(x)),
      //new OutputNeuron("MVRND", x => b.moveRandom(x)),
      new OutputNeuron("SETDR", x => b.setDir(x)),
      new OutputNeuron("TURND", x => b.turn(x)),
      new OutputNeuron("APHRM", x => b.dropPheromone(x)),
    ];
    
    this.hidden = [];
    for (var i = 0; i < hiddenCount; i++) {
      this.hidden.push(new Neuron("HID" + i));
    }
    
    b.genome.genes.forEach(g => this.addGene(g));
  }
  
  addGene(g) {
    /*
    // This method allows for cycles and graph evaluation
    // needs to be updated to handle walking cycles.
    // 16 bits:
    // 15: input src
    // 12-14: input id
    // 11: output src
    // 8-10: output id
    // 0-7: weight
    // input
    const inHidden = false; //(g >> 15) != 0;
    const inSrc = inHidden ? this.hidden : this.inputs;
    const inId = ((g >> 12) & 7) % inSrc.length;
    
    // output
    // don't allow hidden as output until there's cycle detection or something
    const outHidden = false; //((g >> 8) & 8) != 0;
    const outDest = outHidden ? this.hidden : this.outputs;
    const outId = ((g >> 8) & 7) % outDest.length;
    
    // weight
    const weight = (norm((g & 0xff), 0, 0xff) - 0.5) * 3;
    outDest[outId].addInput(inSrc[inId], weight);
    */
    
    // 16 bits:
    // 15: layer (in->hidden, hidden->out)
    // 11-14: input id
    // 7-10: output id
    // 0-6: weight
    const layer0 = (g >> 15) == 0;
    const inSrc = layer0 ? this.inputs : this.hidden;
    const outDest = layer0 ? this.hidden : this.outputs;
    
    const inId = ((g >> 11) & 0xf) % inSrc.length;
    const outId = ((g >> 7) & 0xf) % outDest.length;
    
    // weight
    const weight = (norm((g & 0x7f), 0, 0x7f) - 0.5) * 3;
    outDest[outId].addInput(inSrc[inId], weight);
  }
  
  activate() {
    this.outputs.forEach(x => {
      if (x.inputs.length) {
        x.activate();
      }
    });
  }
  
  dump() {
    var result = "";
    this.hidden.forEach(x => result += x.dump());
    this.outputs.forEach(x => result += x.dump());
    return result;
  }
}


class Pheromone {
  constructor(pos) {
    this.pos = { x: pos.x, y: pos.y };
    this.level = 1;
  }

  fade() {
    this.level -= 0.05;
    return this.level > 0;
  }

  // Centered and scaled coordinates.
  get cx() {
    return (this.pos.x * cellW) + (cellW / 2);
  }

  get cy() {
    return (this.pos.y * cellH) + (cellH / 2);
  }
}

function my_dist(x1, y1, x2, y2) {
  return sqrt(pow(x2-x1,2)+pow(y2-y1,2));
}

class Bug {
  constructor(pos, genome) {
    this.pos = pos;
    this.dir = random();  // angle 0-1 like PICO-8
    this.genome = new Genome();
    this.hungerVal = 1;
    this.metabolism = 1 / (genIterations * 0.8);
    
    if (genome == undefined) {
      this.genome.randomize(geneCount);
    } else {
      this.genome.mutateFrom(genome);
    }
    
    this.brain = new Brain(this);
    this.clearCache();
  }

  clearCache() {
    this.pheromoneDirVal = undefined;
    this.neighborCountVal = undefined;
    this.neighborDirVal = undefined;
  }

  get identity() {
    return this.genome.identity;
  }

  // Centered and scaled coordinates.
  get cx() {
    return (this.pos.x * cellW) + (cellW / 2);
  }

  get cy() {
    return (this.pos.y * cellH) + (cellH / 2);
  }
  
  get neighborCount() {
    if (this.neighborCountVal == undefined) {
      const rad = 3;
      var [count, total] = board.neighborCount(this.pos.x, this.pos.y, rad);
      this.neighborCountVal = count / total;
    }
    
    return this.neighborCountVal;
  }

  get pheromoneDir() {
    if (this.pheromoneDirVal == undefined) {
      const rad = 5;
      var phmCenter = board.getPheromoneCenter(this.pos.x, this.pos.y, rad);

      if (phmCenter == undefined ||
        (this.pos.x == phmCenter.x && this.pos.y == phmCenter.y)) {
        this.pheromoneDirVal =-1;
      } else {
        this.pheromoneDirVal = atan2_1(this.pos.x - phmCenter.x, this.pos.y - phmCenter.y);
        stroke(0, 0x80, 0xff, 0x90);
        line(this.cx, this.cy, phmCenter.x * cellW, phmCenter.y * cellH);
      }
    }
    
    return this.pheromoneDirVal;
  }

  get neighborDir() {
    if (this.neighborDirVal == undefined) {
      const rad = 5;
      var nCenter = board.getNeighborCenter(this.pos.x, this.pos.y, rad);

      if (nCenter == undefined ||
        (this.pos.x == nCenter.x && this.pos.y == nCenter.y)) {
        this.neighborDirVal = -1;
      } else {
        this.neighborDirVal = atan2_1(this.pos.x - nCenter.x, this.pos.y - nCenter.y);
        stroke(0x80, 0x80);
        line(this.cx, this.cy, nCenter.x * cellW, nCenter.y * cellH);
      }
    }

    return this.neighborDirVal;
  }

  get age() {
    return iteration / genIterations;
  }
  
  get hunger() {
    return this.hungerVal;
  }
  
  get posX() {
    return norm(this.pos.x, 0, board.width - 1);
  }
  
  get posY() {
    return norm(this.pos.x, 0, board.width - 1);
  }
  
  get safety() {
    if (!isSafe(this.pos.x, this.pos.y)) {
      return 0;
    }

    var d = abs(dist(this.pos.x, this.pos.y, safeZone.cx, safeZone.cy));
    return max(norm(d, safeZone.rad, 0), 0);
  }

  get isBlocked() {
    return board.isBlocked(this.pos.x, this.pos.y, this.dir) ? 1 : 0;
  }

  get isSafeAhead() {
    var [nx, ny] = [this.pos.x, this.pos.y];
    var units = 1;

    // Look forward for safety.
    while (units <= 10) {
      [nx, ny] = board.getNextCoord(nx, ny, this.dir);
      if (isSafe(nx, ny)) {
        return 1 / units;
      }
      units++;
    }

    return 0;
  }

  update() {
    if (this.hunger <= 0) {
      return;
    }

    if (isSafe(this.pos.x, this.pos.y)) {
      this.hungerVal += this.metabolism;
    } else {
      this.hungerVal -= this.metabolism;
    }
    
    this.hungerVal = mid(0, this.hungerVal, 1);
    
    this.clearCache();
    this.brain.activate();
  }

  turn(level) {
    this.dir = fract(abs(this.dir + level));
  }
  
  setDir(level) {
    this.dir = fract(abs(level));
  }

  moveForward(level) {
    if (round(level) > 0) {
      this.pos = board.move(this.pos.x, this.pos.y, this.dir);
    }
  }

  moveBackward(level) {
    if (round(level) > 0) {
      this.pos = board.move(this.pos.x, this.pos.y, this.dir);
    }
  }

  moveRandom(level) {
    if (round(level) > 0) {
      this.pos = board.move(this.pos.x, this.pos.y, random());
    }
  }

  dropPheromone(level) {
    if (round(level) > 0) {
      board.addPheromone(new Pheromone(this.pos));
    }

  }
}

class Stats {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.generation = 0;
    this.survival = 0;
    this.offspringPerSurvivor = 0;
    this.speciesCount = 0;
    this.largestSpecies = 0;
    this.brainDump = "";
  }
  
  render(d) {
    var text = "<table>\n";
    
    text += "<tr><td>Survival: " + this.survival + "%</td><td>Generation: " + this.generation + "</td></tr>\n";
    text += "<tr><td>Offspring Per: " + this.offspringPerSurvivor + "</td><td>Species: " + this.speciesCount + "</td></tr>\n";
    text += "<tr><td>Largest Species: " + this.largestSpecies + "</td></tr>\n";   
    text += "<tr><td>Largest Species Brain:\n</td></tr>";
    text += "<tr><td colspan='2'><pre>" + this.brainDump + "</pre></td></tr>\n";
 
    text += "</table>\n";
    d.html(text);
  }
}


const cellW = 6;
const cellH = 6;
const board = new Board(80, 80);
const maxBoardIndex = board.width * board.height;
const stats = new Stats();

const bugCount = 500;
var geneCount = 12;
var hiddenCount = 3;
var mutationRate = 0.001;
const genIterations = 120;
var iteration = 0;
var fastForwardGens = 0;

var debugDiv;
var sldX1;
var sldX2;
var sldY1;
var sldY2;

const safeZone = {
  x1: 10, y1: 10,
  x2: board.width / 2, y2: board.height - 10,
  cx: 0, cy: 0,
  rad: 0
};


function toggleLoop() {
  if (isLooping()) {
    noLoop();
  } else {
    loop();
  }
}


function init() {
  iteration = 0;
  board.reset();
  
  for (var i = 0; i < bugCount; i++) {
    const ix = int(random(maxBoardIndex));
    board.addBug(new Bug(board.getCoord(ix)));
  }
  
  stats.reset();
  stats.render(debugDiv);
}


function survivorStats(survivors) {
  const groups = survivors.reduce((a, x) => {
    if (a.get(x.identity) == undefined) {
      a.set(x.identity, []);
    }

    a.get(x.identity).push(x);
    return a;
  }, new Map());
  
  var largest;
  groups.forEach((v, k) => {
    if (largest == undefined || largest.group.length < v.length) {
      largest = {id: k, group: v};
    }
  });
  
  stats.speciesCount = groups.size;
  
  if (largest) {
   stats.largestSpecies = largest.group.length;
   stats.brainDump = largest.group[0].brain.dump();
  }
}


function isSafe(x, y) {
  return x >= safeZone.x1 &&
    x < safeZone.x2 &&
    y >= safeZone.y1 &&
    y < safeZone.y2;
}


function updateSafeZone() {
  safeZone.x1 = sldX1.value();
  safeZone.x2 = sldX2.value();
  safeZone.y1 = sldY1.value();
  safeZone.y2 = sldY2.value();
  
  safeZone.cx = round(safeZone.x1 + ((safeZone.x2 - safeZone.x1) / 2));
  safeZone.cy = round(safeZone.y1 + ((safeZone.y2 - safeZone.y1) / 2));

  safeZone.rad = dist(safeZone.x1, safeZone.y1, safeZone.cx, safeZone.cy);
}


function nextGeneration()
{
  iteration = 0;
  stats.generation++;
  
  var survivors = [];
  board.bugs.forEach(b => {
    //if (isSafe(b.pos.x, b.pos.y)) {
    if (b.hunger > 0) {
      survivors.push(b);
    }
  });
  
  stats.survival = round(100 * survivors.length / board.bugs.length);
  
  board.reset();
  survivorStats(survivors);
  stats.offspringPerSurvivor = floor(bugCount / survivors.length);
  
  survivors.forEach(b => {
    for (var i = 0; i < stats.offspringPerSurvivor; i++) {
      const ix = int(random(maxBoardIndex));
      board.addBug(new Bug(board.getCoord(ix), b.genome));
    }
  });
  
  stats.render(debugDiv);
}


function setup() {
  var canvas = createCanvas(board.width * cellW, board.height * cellH);
  
  var ctrlDiv = createDiv();
  ctrlDiv.class("controls");
  ctrlDiv.style("width:" + board.width * cellW);
  
  var resetBtn = createButton("Restart");
  resetBtn.mousePressed(init);
  resetBtn.parent(ctrlDiv);
  
  var pauseBtn = createButton("Pause");
  pauseBtn.mousePressed(toggleLoop);
  pauseBtn.parent(ctrlDiv);

  var ffBtn = createButton("Skip 10");
  ffBtn.mousePressed(() => { fastForwardGens = 10; });
  ffBtn.parent(ctrlDiv);
  
  var safeZoneDiv = createDiv("Safe Zone");
  safeZoneDiv.parent(ctrlDiv);
  var safeRanges = createDiv();
  safeRanges.class("safeRanges");
  safeRanges.parent(safeZoneDiv);
  sldX1 = createSlider(0, board.width, safeZone.x1);
  sldX1.parent(safeRanges);
  sldX2 = createSlider(0, board.width, safeZone.x2);
  sldX2.parent(safeRanges);
  sldY1 = createSlider(0, board.height, safeZone.y1);
  sldY1.parent(safeRanges);
  sldY2 = createSlider(0, board.height, safeZone.y2);
  sldY2.parent(safeRanges);
  
  var paramsDiv = createDiv("Parameters");
  paramsDiv.parent(ctrlDiv);
  var inputsDiv = createDiv();
  inputsDiv.parent(ctrlDiv);
  
  var spanGenes = createSpan("Gene Count: ");
  spanGenes.class("sliderGroup");
  spanGenes.parent(inputsDiv);
  var spanGenesVal = createSpan(geneCount);
  spanGenesVal.parent(spanGenes);
  var sldGenes = createSlider(2, 32, geneCount);
  sldGenes.parent(spanGenes);
  sldGenes.input(() => {
    geneCount = round(sldGenes.value());
    spanGenesVal.html(geneCount);
  });
  
  var spanHidden = createSpan("Hidden Neurons: ");
  spanHidden.class("sliderGroup");
  spanHidden.parent(inputsDiv);
  var spanHiddenVal = createSpan(hiddenCount);
  spanHiddenVal.parent(spanHidden);
  var sldHidden = createSlider(1, 8, hiddenCount);
  sldHidden.parent(spanHidden);
  sldHidden.input(() => {
    hiddenCount = round(sldHidden.value());
    spanHiddenVal.html(hiddenCount);
  });
  
  var spanMutate = createSpan("Mutate Rate: ");
  spanMutate.class("sliderGroup");
  spanMutate.parent(inputsDiv);
  var spanMutateVal = createSpan(mutationRate);
  spanMutateVal.parent(spanMutate);
  var sldMutate = createSlider(0, 5, 3);
  sldMutate.parent(spanMutate);
  sldMutate.input(() => {
    mutationRate = 1/pow(10, round(sldMutate.value()));
    spanMutateVal.html(mutationRate);
  });
  
  debugDiv = createDiv();
  debugDiv.class("debug");
  debugDiv.style("width:" + board.width * cellW);
  
  frameRate(30);
  init();
}


function update() {
  board.bugs.forEach(b => b.update());
}


function drawBug(b) {  
  var r = cellW / 2;

  if (b.hunger == 0) {
    noStroke();
    fill(0x80);
    circle(b.cx, b.cy, 2 * r * 0.8);
    return;
  }

  stroke(0x7f, 0x60);
  fill(b.genome.color);
  circle(b.cx, b.cy, 2 * r * 0.8);

  stroke(255);
  line(b.cx, b.cy, b.cx + r * cos_1(b.dir), b.cy + r * sin_1(b.dir));
}


function drawPheromone(p) {
  stroke(0, 0x80, 0xff, 0x90 * p.level);
  noFill();
  circle(p.cx, p.cy, cellW);
}


function draw() {
  if (fastForwardGens > 0) {
    while (iteration++ <= genIterations) {
      update();
    }
    
    background(32);
    board.bugs.forEach(drawBug);
    
    nextGeneration();
    fastForwardGens--;
    
    return;
  }
  
  updateSafeZone();
  board.fadePheromones();
  update();
  iteration++;
  
  //background(32);
  fill(0x1f, 0x60);
  noStroke();
  rect(0, 0, width, height);
  
  // Draw grid.
  /*
  noFill();
  for (var r = 0; r < board.height; r++) {
    for (var c = 0; c < board.width; c++) {
      const safe = isSafe(c, r);
      stroke(safe ? "darkgreen" : "darkred");
      rect(c * cellW, r * cellH, cellW, cellH);
    }
  }
  */

  board.bugs.forEach(drawBug);
  board.pheromones.forEach(drawPheromone);
  
  fill(0, 0x70, 0, 0x10);
  noStroke();
  rect(safeZone.x1 * cellW, safeZone.y1 * cellH,
    (safeZone.x2 - safeZone.x1) * cellW,
    (safeZone.y2 - safeZone.y1) * cellH);
  
  fill(200);
  text(iteration, 2, height - 5);
  
  if (iteration > genIterations) {
    nextGeneration();
  }
}
