class FieldEmitter {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.dx = random(2) - 1;
    this.dy = random(2) - 1;
    this.strength = random(10, 30);
  }
  
  getForce(x, y) {
    var d = dist(x, y, this.x, this.y);
    var dx = (x - this.x) / d;
    var dy = (y - this.y) / d;
    var mul = (this.strength / d);
    
    return { dx: dx * mul, dy: dy * mul };
  }
  
  update() {
    this.x += this.dx;
    this.y += this.dy;
    
    if (this.x < 0 || this.x > displayWidth) { this.dx *= -1; }
    if (this.y < 0 || this.y > displayHeight) { this.dy *= -1; }
  }
}

class Particle {
  constructor(x) {
    this.initX = x;
    this.x = x;
    this.y = random(displayHeight);
    this.px = x;
    this.py = 0;
    this.dx = 0;
    this.dy = 0;
    this.drag = random(5, 9) / 10;
    this.done = false;
  }
  
  update() {
    // Restoring force.
    this.dx += (this.initX - this.x) / 10;
    
    this.px = this.x;
    this.py = this.y;
    this.x += this.dx;
    this.y += this.dy;
    this.dx *= this.drag;
    this.dy *= this.drag;
    
    if (this.py > displayHeight) {
      this.y = 0;
      this.py = 0;
    }
  }
  
  draw() {
    if (this.done) {
      return;
    }
    line(this.x, this.y, this.px, this.py);
  }
}

class Board {
  constructor() {
    this.particles = [];
    this.emitters = [];
    
    for (var i = 0; i < displayWidth; i += 0.1) {
      this.particles.push(new Particle(i));
    }
    
    var emitterCount = displayWidth * displayHeight / 100000;
    for (i = 0; i < emitterCount; i++) {
      var x = random(0, displayWidth);
      var y = random(0, displayHeight);
      this.emitters.push(new FieldEmitter(x, y));
    }
  }
  
  update() {
    var allDone = true;
    
    for (var p of this.particles) {
      if (p.done) {
        continue;
      }
      
      allDone = false;
      
      // Gravitational force.
      p.dy += 0.8;
      
      for (var e of this.emitters) {
        var f = e.getForce(p.x, p.y);
        p.dx += f.dx;
        p.dy += f.dy;
      }
      
      p.update();
    }
    
    for (var e of this.emitters) {
      e.update();
    }
    
    return allDone;
  }
  
  draw() {
    for (const p of this.particles) {
      p.draw();
    }
  }
}

var board = null;

function setup() {
  createCanvas(displayWidth, displayHeight);
  background(0);
  board = new Board();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  board = new Board();
}

function draw() {
  if (board.update()) {
    noLoop();
  }
  background(0, 8);
  stroke(255, 50);
  board.draw();
}
