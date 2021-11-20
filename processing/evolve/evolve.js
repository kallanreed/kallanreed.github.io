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
      const r = (this.identity) & 0xFF;
      const g = (this.identity >> 8) & 0xFF;
      const b = (this.identity >> 16) & 0xFF;
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
    // TODO: allow self-input?
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
    // TODO: how to make sense of cycles? Use the prev
    // value instead of the recursive call?
    // Don't allow hidden cycles?
    
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
      result += x.neuron.dump();
      
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
    // 16 bits:
    // 15: input src
    // 12-14: input id
    // 11: output src
    // 8-10: output id
    // 1-7: weight
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
  
  get closestWall() {
    
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


const cellW = 10;
const cellH = 10;
const board = new Board(80, 80);
const maxBoardIndex = board.width * board.height;
const stats = new Stats();

const bugCount = 400;
const geneCount = 4;
const hiddenCount = 2;
const mutationRate = 0.001;
const genIterations = 90;
var iteration = 0;

var debugDiv;
const safeZone = {
  x1: 0, y1: 20,
  x2: 50, y2: 60
};

function drawBug(b) {
  fill(b.genome.color);
  stroke(128);
  circle(b.pos.x * cellW + cellW / 2,
         b.pos.y * cellH + cellH / 2, 7);
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
  createCanvas(board.width * cellW, board.height * cellH);
  debugDiv = createDiv();
  debugDiv.class("debug");
  
  frameRate(30);
  init();
}

function update() {
  board.bugs.forEach(b => b.update());
}


function draw() {
  update();
  iteration++;
  
  background(32);
  noFill();
  
  for (var r = 0; r < board.height; r++) {
    for (var c = 0; c < board.width; c++) {
      const safe = isSafe(c, r);
      stroke(safe ? "darkgreen" : "darkred");
      rect(c * cellW, r * cellH, cellW, cellH);
    }
  }
  
  board.bugs.forEach(drawBug);
  
  fill(200);
  text(iteration, 2, height - 5);
  
  if (iteration > genIterations) {
    nextGeneration();
  }
}

function mousePressed() {
  [safeZone.x1, safeZone.y1] = [floor(mouseX / cellW), floor(mouseY / cellH)];
  noLoop();
}

function mouseReleased() {
  [safeZone.x2, safeZone.y2] = [floor(mouseX / cellW), floor(mouseY / cellH)];
  loop();
  init();
}
