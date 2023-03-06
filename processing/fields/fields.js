class FieldEmitter {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.dx = random(2) - 1;
    this.dy = random(2) - 1;
    this.size = windowWidth / 1000 * random(20, 40);
  }

  getForce(x, y) {
    var d = dist(x, y, this.x, this.y);

    if (d === 0) {
      return { dx: 0, dy: 0 };
    }

    var dx = this.size * (x - this.x) / (d * d);
    var dy = this.size * (y - this.y) / (d * d);
    
    return { dx: dx, dy: dy };
  }
  
  update() {
    this.x += this.dx;
    this.y += this.dy;
    
    if (this.x < 0 || this.x > windowWidth) { this.dx *= -1; }
    if (this.y < 0 || this.y > windowHeight) { this.dy *= -1; }
  }
}

class Particle {
  constructor(x) {
    this.initX = x;
    this.x = x;
    this.y = random(windowHeight);
    this.px = x;
    this.py = 0;
    this.dx = 0;
    this.dy = 0;
    this.drag = random(6, 8) / 10;
  }
  
  update() {
    // Restoring force.
    this.dx += (this.initX - this.x) / 100;
    
    this.px = this.x;
    this.py = this.y;
    this.x += this.dx;
    this.y += this.dy;
    this.dx *= this.drag;
    this.dy *= this.drag;
    
    if (this.py > windowHeight) {
      this.y = 0;
      this.py = this.y - this.py;
    }
  }
  
  draw() {
    line(this.x, this.y, this.px, this.py);
  }
}

class Board {
  constructor() {
    this.particles = [];
    this.emitters = [];
    
    for (var i = 0; i < windowWidth; i += 0.1) {
      this.particles.push(new Particle(i));
    }

    var emitterCount = 10; //windowWidth * windowHeight / 100000;
    for (i = 0; i < emitterCount; i++) {
      var x = random(0, windowWidth);
      var y = random(0, windowHeight);
      this.emitters.push(new FieldEmitter(x, y));
    }
  }
  
  draw() {
    for (var e of this.emitters) {
      e.update();
    }

    for (const p of this.particles) {
      // Gravitational force.
      p.dy += 0.85;

      for (var e of this.emitters) {
        var f = e.getForce(p.x, p.y);
        p.dx += f.dx;
        p.dy += f.dy;
      }

      p.update();
      p.draw();
    }
  }
}

var board = null;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(0);
  board = new Board();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  board = new Board();
}

function draw() {
  background(0, 8);
  stroke(255, 50);
  board.draw();
}

function mousePressed()
{
  var e = random(board.emitters);
  e.x = mouseX;
  e.y = mouseY;
}