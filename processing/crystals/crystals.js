function* pairs(arr) {
  for (var i = 0; i < arr.length - 1; i++) {
    if (arr[i] === null) { continue; }
    
    for (var j = i + 1; j < arr.length; j++) {
      if (arr[j] === null) { continue; }
      
      yield {first: arr[i], second: arr[j]};

      /* NOTE INDEX UPDATE */
      i = j;
    }
  }
}

class Crystal
{ 
  constructor(x, y, bounds) {
    this.x = x;
    this.y = y;
    this.bounds = bounds;
    this.dx = random(-1, 1);
    this.dy = random(-1, 1);
    this.neighbors = [];
    this.pairs = [];
    this.colors = [];
  }

  setNeighbors(neighbors) {
    this.neighbors = neighbors;
    this.pairs = Array.from(pairs(this.neighbors));
    
    this.colors = [];
    for (var i = 0; i < this.pairs.length; i++) {
      this.colors.push(color(random(64, 255), 20));
    }
  }

  draw() {
    for (var ix = 0; ix < this.pairs.length; ix++) {
      var p = this.pairs[ix];
      fill(this.colors[ix]);
      triangle(this.x, this.y, p.first.x, p.first.y, p.second.x, p.second.y);
    }
  }

  drawTo(other) {
    if (this.x < other.x || this.y < other.y) { 
      line(this.x, this.y, other.x, other.y);
    }
  }
  
  update() {
    this.x += this.dx;
    this.y += this.dy;
    
    if (this.x < this.bounds.x1 || this.x >= this.bounds.x2) {
      this.dx = -this.dx;
    }
    
    if (this.y < this.bounds.y1 || this.y >= this.bounds.y2) {
      this.dy = -this.dy;
    }
  }
}

class Board
{
  constructor(w, h) {
    this.rowHeight = 80;
    this.colWidth = 80;
    this.rowCount = floor(h / this.rowHeight);
    this.colCount = floor(w / this.colWidth);
    this.cells = [];

    this.forEachIndex(ix => {
      var bounds = this.getCellBounds(ix);
      this.cells.push(new Crystal(random(bounds.x1, bounds.x2),
                                  random(bounds.y1, bounds.y2),
                                  bounds));
    });
    
    this.forEachCell((ix, c) => c.setNeighbors(this.getNeighbors(ix)));
  }

  forEachIndex(fn) {
    for (var ix = 0; ix < this.rowCount * this.colCount; ix++) {
      fn(ix);
    }
  }

  forEachCell(fn) {
    this.forEachIndex(ix => fn(ix, this.cells[ix]));
  }

  getCellBounds(index) {
    var rc = this.indexToRowCol(index);
    return {
      x1: rc.col * this.colWidth,
      y1: rc.row * this.rowHeight,
      x2: (rc.col + 1) * this.colWidth,
      y2: (rc.row + 1) * this.rowHeight
    };
  }

  indexToRowCol(index) {
    var row = floor(index / this.colCount);
    var col = index % this.colCount;
    return { col, row };
  }

  pixelToIndex(x, y) {
    var col = floor(x / this.colWidth);
    var row = floor(y / this.rowHeight);
    return this.rowColToIndex(col, row);
  }

  rowColToIndex(col, row) {
    if (col < 0 || col >= this.colCount ||
        row < 0 || row >= this.rowCount) {
      return -1;
    }

    return floor(row * this.colCount + col);
  }

  getAt(col, row) {
    var ix = this.rowColToIndex(col, row);
    return ix >= 0 ? this.cells[ix] : null;
  }

  getNeighbors(index) {
    var rc = this.indexToRowCol(index);
    return [
      this.getAt(rc.col + 1, rc.row),     // E
      this.getAt(rc.col + 1, rc.row - 1), // NE
      this.getAt(rc.col,     rc.row - 1), // N
      this.getAt(rc.col - 1, rc.row - 1), // NW
      this.getAt(rc.col - 1, rc.row),     // W
      this.getAt(rc.col - 1, rc.row + 1), // SW
      this.getAt(rc.col,     rc.row + 1), // S
      this.getAt(rc.col + 1, rc.row + 1), // SE
    ];
  }

  draw() {
    stroke(0, 64);
    this.forEachCell((ix, c) => {
      var rc = this.indexToRowCol(ix);
      if ((rc.row & 1) == 1) {
        c.draw();
      }
    });
  }
  
  update() {
    this.forEachCell((ix, c) => c.update());
  }
}

var board;

function setup() {
  createCanvas(windowWidth, windowHeight);
  board = new Board(windowWidth, windowHeight);
  background(0);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  board = new Board(windowWidth, windowHeight);
  background(0);
}

function draw() {
  background(0, 20);
  board.draw();
  board.update();
}
