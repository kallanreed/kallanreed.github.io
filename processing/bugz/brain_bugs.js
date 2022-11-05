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
  }

  addInput(src, weight) {
    this.inputs.push( {
      src, weight
    }
    );
  }

  evaluate() {
    var total = 0;
    this.inputs.forEach(i => total += i.src.value * i.weight);
    this.value = tanh(total);
  }
}

class Sense extends Node {
  constructor(inputFn) {
    super();
    this.inputFn = inputFn;
  }

  evaluate() {
    this.value = this.inputFn();
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
    for (var i = 0; i < 10; i++) {
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
      new Sense(() => this.bug.lookForward()), 
      new Sense(() => this.bug.deltaEnergy), 
      new Sense(() => this.bug.energy), 
      new Sense(() => cos(frameCount / 180)), 
    ];

    this.hidden = [
      new Node(), 
      new Node(), 
      new Node(), 
    ];

    this.outputs = [
      new Action(v => {
      if (v > 0.5) {
        bug.walkForward();
      }
    }
    ), 
      new Action(v => {
      if (v > 0.5) {
        bug.walkBackward();
      }
    }
    ), 
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

  walkForward() {
    this.x += cos(this.dir);
    this.y -= sin(this.dir);
  }

  walkBackward() {
    this.x -= cos(this.dir);
    this.y += sin(this.dir);
  }

  lookForward() {
    var x = this.x + (this.dia * cos(this.dir));
    var y = this.y - (this.dia * sin(this.dir));

    stroke(0, 255, 255, 60);
    circle(x, y, this.dia * 2);

    if (overlapsFood(x, y, this.r) !== null) { 
      return 1;
    }
    if (overlapsTrap(x, y, this.r) !== null) { 
      return -1;
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
      this.energy -= 0.025;
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
    if (!this.alive) {
      stroke(128);
      circle(this.x, this.y, this.dia);
      return false;
    }

    stroke(255, 255, 0);
    line(this.x, this.y, 
      this.x + (5 * cos(this.dir)), 
      this.y - (5 * sin(this.dir)));

    stroke(0, 255, 0);
    line(this.x - 5, this.y, this.x - 5 + (10 * this.energy), this.y);

    stroke(255, 120, 70);
    circle(this.x, this.y, this.dia);

    this.update();
    return this.alive;
  }
}

class Item {
  constructor(x, y, r) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.dia = this.r * 2;
  }
}

class Food extends Item {
  constructor(x, y) {
    super(x, y, 8);
  }

  draw() {
    stroke(0, 255, 0);
    circle(this.x, this.y, this.dia);
  }

  eat() {
    this.r -= 0.5;
    this.dia = this.r * 2;
  }
}

class Danger extends Item {
  constructor(x, y) {
    super(x, y, 10);
  }

  draw() {
    stroke(255, 0, 0);
    circle(this.x, this.y, this.dia);
  }
}

var bugs = [];
var food = [];
var traps = [];
var bestBug = null;

function overlapsAnyItem(items, x, y, r) {
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (overlaps(x, y, r, item.x, item.y, item.r)) {
      return item;
    }
  }
  return null;
}

function overlapsFood(x, y, r) {
  var f = overlapsAnyItem(food, x, y, r);
  return f !== null && f.r > 0 ? f : null;
}

function overlapsTrap(x, y, r) {
  return overlapsAnyItem(traps, x, y, r);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  initBoard();
}

function initBoard() {
  var oldBugs = bugs;
  bugs = [];
  food = [];
  traps = [];
  var i = 0;
  var g = null;

  if (oldBugs.length > 0) {
    for (i = 0; i < oldBugs.length; i++) {
      var ob = oldBugs[i];
      for (var j = 0; j < ob.ateCount; j++) {
        g = new Genome();
        g.mutateFrom(ob.genome);
        bugs.push(new Bug(windowWidth / 2, windowHeight / 2, 0, g));
      }
    }
  } else {
    for (i = 0; i < 100; i++) {
      g = new Genome();
      g.randomize();
      bugs.push(new Bug(windowWidth / 2, windowHeight / 2, 0, g));
    }
  }

  for (i = 0; i < 50; i++) {
    food.push(new Food(random(windowWidth), random(windowHeight)));
  }

  for (i = 0; i < 20; i++) {
    traps.push(new Danger(random(windowWidth), random(windowHeight)));
  }

  background(0);
}

function draw() {
  background(0);
  noFill();
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
