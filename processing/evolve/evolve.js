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
  }
  
  addBug(b) {
    this.bugs.push(b);
    this.setCell(b.pos.x, b.pos.y, b);
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
  
  neighborCount(x, y) {
    let n = (x, y) => this.getCell(x, y) != undefined ? 1 : 0;
    
    return n(x - 1, y - 1) + n(x, y - 1) + n(x + 1, y - 1) +
           n(x - 1, y)     +               n(x + 1, y)     +
           n(x - 1, y + 1) + n(x, y + 1) + n(x + 1, y + 1);
  }
  
  // 0=E, 1=NE, 2=N, 3=NW, 4=W, 5=SW, 6=S, 7=SE
  move(x, y, dir) {
    var [nx, ny] = [x, y];
    
    switch (dir) {
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
    
    nx = mid(0, nx, board.width);
    ny = mid(0, ny, board.height);
    
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
    this.inputs = [
      new InputNeuron("RND", () => random(-1, 1)),
      new InputNeuron("OSC", () => norm(iteration % 30, 0, 30)),
      new InputNeuron("NCT", () => norm(b.neighborCount, 0, 8)),
      new InputNeuron("PSX", () => b.posX),
      new InputNeuron("PSY", () => b.posY),
      new InputNeuron("SZD", () => b.safeZoneDist),
      new InputNeuron("DSZ", () => b.dirSafeZone),
    ];

    this.outputs = [
      new OutputNeuron("MNS", x => b.moveY(x)),
      new OutputNeuron("MEW", x => b.moveX(x)),
      new OutputNeuron("MRN", x => b.moveRnd(x)),
      new OutputNeuron("MDR", x => b.moveDir(x)),
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

class Bug {
  constructor(pos, genome) {
    this.pos = pos;
    this.genome = new Genome();
    
    if (genome == undefined) {
      this.genome.randomize(geneCount);
    } else {
      this.genome.mutateFrom(genome);
    }
    
    this.brain = new Brain(this);
  }
  
  get identity() {
    return this.genome.identity;
  }
  
  get neighborCount() {
    return board.neighborCount(this.pos.x, this.pos.y);
  }
  
  get safeZoneDist() {
    var d = dist(this.pos.x, this.pos.y, safeZone.cx, safeZone.cy);
    return mid(-1, norm(d, -15, 15), 1);
  }
  
  get dirSafeZone() {
    var d = atan2(this.pos.y - safeZone.cy, this.pos.x - safeZone.cx) + PI;
    return norm(d, -PI, PI);
  }
  
  get posX() {
    return norm(this.pos.x, 0, board.width);
  }
  
  get posY() {
    return norm(this.pos.y, 0, board.height);
  }
  
  update() {
    this.brain.activate();
  }
  
  moveX(level) {
    var norm = round(level);
    if (norm == 0) { return; }
    
    const d = norm > 0 ? 0 : 4;
    this.pos = board.move(this.pos.x, this.pos.y, d);
  }
  
  moveY(level) {
    var norm = round(level);
    if (norm == 0) { return; }
    
    const d = norm > 0 ? 2 : 6;
    this.pos = board.move(this.pos.x, this.pos.y, d);
  }
  
  moveRnd(level) {
    if (level > 0.5) {
      const d = floor(random(8));
      this.pos = board.move(this.pos.x, this.pos.y, d);
    }
  }
  
  moveDir(level) {
    var d = abs(floor(level * 8) % 8);
    this.pos = board.move(this.pos.x, this.pos.y, d);
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


const cellW = 7;
const cellH = 7;
const board = new Board(80, 80);
const maxBoardIndex = board.width * board.height;
const stats = new Stats();

const bugCount = 500;
var geneCount = 4;
var hiddenCount = 2;
var mutationRate = 0.001;
const genIterations = 120;
var iteration = 0;

var debugDiv;
var sldX1;
var sldX2;
var sldY1;
var sldY2;

const safeZone = {
  x1: 0, y1: 0,
  x2: board.width / 3, y2: board.width,
  cx: 0, cy: 0
};


function toggleLoop() {
  if (isLooping()) {
    noLoop();
  } else {
    loop();
  }
}


function drawBug(b) {
  fill(b.genome.color);
  circle(b.pos.x * cellW + cellW / 2,
         b.pos.y * cellH + cellH / 2, cellW * 0.7);
}


function init() {
  iteration = 0;
  board.reset();
  
  for (var i = 0; i < bugCount; i++) {
    // TODO: collision
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
    x <= safeZone.x2 &&
    y >= safeZone.y1 &&
    y <= safeZone.y2;
}


function updateSafeZone() {
  safeZone.x1 = sldX1.value();
  safeZone.x2 = sldX2.value();
  safeZone.y1 = sldY1.value();
  safeZone.y2 = sldY2.value();
  
  safeZone.cx = round(safeZone.x1 + ((safeZone.x2 - safeZone.x1) / 2));
  safeZone.cy = round(safeZone.y1 + ((safeZone.y2 - safeZone.y1) / 2));
}


function nextGeneration()
{
  iteration = 0;
  stats.generation++;
  
  var survivors = [];
  board.bugs.forEach(b => {
    if (isSafe(b.pos.x, b.pos.y)) {
      survivors.push(b);
    }
  });
  
  stats.survival = round(100 * survivors.length / board.bugs.length);
  
  board.reset();
  survivorStats(survivors);
  stats.offspringPerSurvivor = floor(bugCount / survivors.length);
  
  survivors.forEach(b => {
    for (var i = 0; i < stats.offspringPerSurvivor; i++) {
      // TODO: collision
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
  
  var safeZoneDiv = createDiv("Safe Zone");
  safeZoneDiv.parent(ctrlDiv);
  var safeRanges = createDiv();
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
  var sldGenes = createSlider(2, 16, geneCount);
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
  sldMutate.style("width: 45%;");
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


function draw() {
  updateSafeZone();
  update();
  iteration++;
  
  background(32);
  
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
  
  stroke(0x7f, 0x60);
  board.bugs.forEach(drawBug);
  
  fill(0, 0x70, 0, 0x20);
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
