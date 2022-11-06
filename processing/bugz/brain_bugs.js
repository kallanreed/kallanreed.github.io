const E = 2.71828;

function tanh(x) {
  const ex = pow(E, x);
  const ex1 = pow(E, -x);
  return (ex - ex1) / (ex + ex1);
}

function overlaps(x1, y1, r1, x2, y2, r2) {
  return dist(x1, y1, x2, y2) - (r1 + r2) <= 0;
}

/*******************************************/

class Node {
  constructor() {
    this.inputs = [];
    this.value = 0;
    
    // Allow skipping unconnected nodes.
    this.needEval = false;
  }

  addInput(src, weight) {
    this.inputs.push( {
      src, weight
    }
    );
  }

  evaluate() {
    if (this.needsEval) {
      var total = 0;
      this.inputs.forEach(i => total += (i.src.value * i.weight));
      this.value = tanh(total);
    }
  }
}

class Sense extends Node {
  constructor(inputFn) {
    super();
    this.inputFn = inputFn;
  }

  evaluate() {
    if (this.needsEval) {
      this.value = this.inputFn();
    }
  }
}

class Action extends Node {
  constructor(actionFn) {
    super();
    this.actionFn = actionFn;
  }

  act() {
    this.actionFn(this.value);
  }
}

class Genome {
  constructor() {
    this.genes = [];
  }

  randomize() {
    for (var i = 0; i < 14; i++) {
      this.genes.push(floor(random(0x10000)));
    }
  }

  mutateFrom(other) {
    for (var i = 0; i < other.genes.length; i++) {
      var gene = other.genes[i];
      var weight = gene & 0x7F * (random() - 0.5);
      gene = (weight & 0x7F) + (gene & 0xFF80);
      this.genes.push(gene);
    }
  }
}

class Brain {
  constructor(bug) {
    this.bug = bug;
    this.inputs = [
      new Sense(() => random(-1, 1)),
      //new Sense(() => this.bug.lookForward()),
      new Sense(() => this.bug.lookLeft()),
      new Sense(() => this.bug.lookRight()),
      new Sense(() => this.bug.deltaEnergy),
      new Sense(() => this.bug.energy),
      new Sense(() => cos(frameCount / 180)),
      new Sense(() => this.bug.hasNeighbor()),
    ];

    this.hidden = [
      new Node(),
      new Node(),
      new Node(),
      new Node(),
      new Node(),
    ];

    this.outputs = [
      new Action(v => {
        if (v > 0.5) {
          bug.walkForward(v);
        }
      }), 
      new Action(v => {
        if (v > 0.5) {
          bug.walkBackward();
        }
      }),
      new Action(v => bug.turn(v)), 
    ];

    this.genome = bug.genome;
    this.genome.genes.forEach(g => this.connect(g));
  }

  connect(gene) {
    /*
    16 bits
     15: target (hidden/output)
     11-14: src id
     7-10:  dst id
     0-6: weight
     */
    gene = gene & 0xFFFF;
    var isHidden = (gene >> 15) == 0;
    var src = isHidden ? this.inputs : this.hidden;
    var dst = isHidden ? this.hidden : this.outputs;
    var srcId = ((gene >> 11) & 0x0F) % src.length;
    var dstId = ((gene >> 7) & 0x0F) % dst.length;

    // Normalize weight to a value from 0..1
    var weight = norm(gene & 0x7F, 0, 0x7F);
    // Shift range from -2..2
    weight = (weight - 0.5) * 4;

    dst[dstId].addInput(src[srcId], weight);
    src[srcId].needsEval = true;
    dst[dstId].needsEval = true;
  }

  update() {
    this.inputs.forEach(x => x.evaluate());
    this.hidden.forEach(x => x.evaluate());
    this.outputs.forEach(x => {
      x.evaluate();
      x.act();
    }
    );
  }
}

class Bug {
  constructor(x, y, dir, genome) {
    this.x = x;
    this.y = y;
    this.r = 6;
    this.dia = this.r * 2;
    this.dir = dir;
    this.energy = 1;
    this.deltaEnergy = 0;
    this.ateCount = 0;
    this.alive = true;
    this.genome = genome;

    this.brain = new Brain(this);
  }

  walkForward(val) {
    this.x += cos(this.dir);
    this.y -= sin(this.dir);
    
    // Dash.
    if (val >= 0.8) {
      this.x += cos(this.dir);
      this.y -= sin(this.dir);
    }
  }

  walkBackward() {
    this.x -= cos(this.dir);
    this.y += sin(this.dir);
  }

  lookForward() {
    return this.lookDir(0);
  }
  
  lookLeft() {
    return this.lookDir(PI/4);
  }
  
  lookRight() {
    return this. lookDir(-PI/4);
  }
  
  lookDir(ddir) {
    var r = 16;
    var x = this.x + (r * cos(this.dir + ddir));
    var y = this.y - (r * sin(this.dir + ddir));

    stroke('#4C99C940');
    strokeWeight(1);
    circle(x, y, r * 2);

    if (overlapsFood(x, y, r) !== null) { 
      return 1;
    }
    if (overlapsTrap(x, y, r) !== null) { 
      return -1;
    }

    return 0;
  }
  
  hasNeighbor() {
    var n = getNeighbor(this);
    if (n !== null) {
      stroke('#F668AC');
      strokeWeight(1);
      circle(this.x, this.y + 2, 4);
      return 1;
    }
    
    return 0;
  }

  turn(val) {
    this.dir += val;
  }

  update() {
    var startingEnergy = this.energy;
    this.energy -= 0.001;

    var food = overlapsFood(this.x, this.y, this.r);
    if (food != null && this.energy < 1) {
      this.energy += 0.05;
      this.ateCount += 1;
      food.eat();
    }

    if (overlapsTrap(this.x, this.y, this.r)) {
      this.energy -= 0.1;
    }

    this.deltaEnergy = this.energy - startingEnergy;

    this.alive = this.energy > 0;
    this.brain.update();
    
    if (this.x < 0) { this.x += windowWidth; }
    if (this.x > windowWidth) { this.x -= windowWidth; }
    if (this.y < 0) { this.y += windowHeight; }
    if (this.y > windowHeight) { this.y -= windowHeight; }
  }

  draw() {
    strokeWeight(2);
    
    if (!this.alive) {
      // Dead
      stroke(128, 48);
      circle(this.x, this.y, this.dia);
      return false;
    }

    // Body
    stroke('#FA5859');
    circle(this.x, this.y, this.dia);
    
    // Direction
    stroke('#F7EBE8'); 
    line(this.x, this.y, 
      this.x + (this.r * cos(this.dir)), 
      this.y - (this.r * sin(this.dir)));

    // Health
    stroke('#37BB8C');
    line(this.x - 5, this.y, this.x - 5 + (10 * this.energy), this.y);

    this.update();
    return this.alive;
  }
}

class Item {
  constructor(x, y, r) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.dx = (random() - 0.5) / 3;
    this.dy = (random() - 0.5) / 3;
    this.valid = true;
  }
  
  dia() { return this.r * 2; }
  
  update() {
    this.x += this.dx;
    this.y += this.dy;
    
    if (this.x < 0) { this.x += windowWidth; }
    if (this.x > windowWidth) { this.x -= windowWidth; }
    if (this.y < 0) { this.y += windowHeight; }
    if (this.y > windowHeight) { this.y -= windowHeight; }
  }
}

class Food extends Item {
  constructor(x, y) {
    super(x, y, floor(random(4, 9)));
  }

  draw() {
    stroke('#8CB244');
    strokeWeight(2);
    circle(this.x, this.y, this.dia());
    this.update();
  }

  eat() {
    this.r -= 1;
    this.valid = this.r > 0;
  }
}

class Danger extends Item {
  constructor(x, y) {
    super(x, y, floor(random(6, 11)));
  }

  draw() {
    stroke(255, 0, 0);
    strokeWeight(2);
    circle(this.x, this.y, this.dia());
    this.update();
  }
}

var bugs = [];
var food = [];
var traps = [];

function overlapsAnyItem(items, x, y, r) {
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (item.valid && overlaps(x, y, r, item.x, item.y, item.r)) {
      return item;
    }
  }
  return null;
}

function overlapsFood(x, y, r) {
  return overlapsAnyItem(food, x, y, r);
}

function overlapsTrap(x, y, r) {
  return overlapsAnyItem(traps, x, y, r);
}

function getNeighbor(b) {
  // TODO: index to remove n^2.
  for (const x of bugs) {
    if (b !== x && x.alive &&
        overlaps(b.x, b.y, b.r * 5, x.x, x.y, x.r)) {
      return x;
    }
  }
  
  return null;
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  initBoard();
}

function initBoard() {
  // Sort the most successful first.
  bugs.sort((a, b) => a.ateCount > b.ateCount);
  var oldBugs = bugs;
  bugs = [];
  food = [];
  traps = [];
  var i = 0;
  var g = null;
  var maxBugs = 100;

  for (i = 0; i < oldBugs.length; i++) {
    var ob = oldBugs[i];
    for (var j = 0; j < ob.ateCount && bugs.length < maxBugs; j++) {
      g = new Genome();
      g.mutateFrom(ob.genome);
      bugs.push(new Bug(windowWidth / 2, windowHeight / 2, PI/2, g));
    }
  }
  
  // Add randos if there weren't any added from the last iteration.
  if (bugs.length == 0) {
    for (i = 0; i < maxBugs; i++) {
      g = new Genome();
      g.randomize();
      bugs.push(new Bug(windowWidth / 2, windowHeight / 2, PI/2, g));
    }
  }
  
  var area = windowHeight * windowWidth; 
  
  for (i = 0; i < area / 8000; i++) {
    food.push(new Food(random(windowWidth), random(windowHeight)));
  }

  for (i = 0; i < area / 15000; i++) {
    var danger = new Danger(random(windowWidth), random(windowHeight));
    
    if (!overlaps(windowWidth / 2, windowHeight / 2, 100, danger.x, danger.y, danger.r)) {
      traps.push(danger);
    }
  }

  background(0);
}

function draw() {
  background('#1E1E24');
  noFill();
  noStroke();
  var anyAlive = false;

  bugs.forEach(b => {
    if (b.draw()) {
      anyAlive = true;
    }
  }
  );
  food.forEach(x => x.draw());
  traps.forEach(x => x.draw());

  if (!anyAlive) {
    initBoard();
  }
}
