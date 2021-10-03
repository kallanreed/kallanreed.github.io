let cos30 = Math.cos(Math.PI / 6);
let sin30 = Math.sin(Math.PI / 6);

function hexa(x, y, rad) {
  quad(x, y - rad, x + rad * cos30, y - rad * sin30, x + rad * cos30, y + rad * sin30, x, y + rad);
  quad(x, y - rad, x - rad * cos30, y - rad * sin30, x - rad * cos30, y + rad * sin30, x, y + rad);
}

let maxAge = 30;
let cellRad = 6;
let colWidth = 2 * cellRad * cos30;
let rowHeight = cellRad + cellRad * sin30;
var cols = 10;
var rows = 10;
var board = [];
var colorMap = [];

function wrap(val, min, max) {
  if (val >= min && val < max) { return val; }
  
  return val >= max ? val - max : val + max;
}

function cellAge(col, row) {
  col = wrap(col, 0, cols);
  row = wrap(row, 0, rows);
  let index = row * cols + col;
  return board[index];
}

function distantNeighborCount(col, row) {
  let fn = (c, r) => cellAge(c, r) > 0 ? 1 : 0;
  
  // Neighbor calculation differs based on if row even/odd.
  let offset = row & 1;
  
  return fn(col - 2, row) + fn(col + 2, row) +  // Same row.
         fn(col, row - 2) + fn(col, row + 2) +  // Same col.
         fn(col - 1, row - 2) + fn(col - 1, row - 2) +  // Finish top and bottom.
         fn(col - 1, row + 2) + fn(col - 1, row + 2) +
         fn(col - 2 + offset, row - 1) + fn(col + 1 + offset , row - 1) + // Diagonals (they have offsets).
         fn(col - 2 + offset , row + 1) + fn(col + 1 + offset , row + 1);
         
}

function neighborCount(col, row) {
  let fn = (c, r) => cellAge(c, r) > 0 ? 1 : 0;
  
  // Neighbor calculation differs based on if row even/odd.
  let offset = row & 1;
  
  return fn(col - 1 + offset, row - 1) + fn(col + offset, row - 1) +
         fn(col - 1, row)              + fn(col + 1, row)          +
         fn(col - 1 + offset, row + 1) + fn(col + offset, row + 1) +
         floor(distantNeighborCount(col, row) / 1.25);
}

function aliveNext(age, neighbors)
{
  //if (age >= maxAge) { return false; }
  
  return (neighbors == 2 && age > 0) || neighbors == 3;
}

function initBoard() {
  cols = ceil(width / colWidth);
  rows = ceil(height / rowHeight);
  
  board = [];
  for (var r = 0; r < rows; r++) {
    for (var c = 1; c < cols; c++) {
      board.push(random() > 0.5 ? 0 : 1);
    }
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  initBoard();
  frameRate(8);
  
  // 'map' is too slow to have in the tight loop so pre-compute this.
  for (var i = 0; i < maxAge; i++) {
    colorMap.push(floor(map(i, 0, maxAge, 255, 64)));
  }
}

function draw() {
  background(32);
  
  let temp = [];
  
  for (var r = 0; r < rows; r++) {
    // Every other row needs to be shifted.
    let offset = (r & 1) == 1 ? colWidth / 2 : 0;
    for (var c = 0; c < cols; c++) {
      let age = cellAge(c, r);
      let nc = neighborCount(c, r);
      
      if (age > 0) {
        let clr = colorMap[age - 1];
        fill(clr);
        stroke(clr);
        hexa(c * colWidth + offset, r * rowHeight, cellRad);
      }
      
      temp.push(aliveNext(age, nc) ? min(age + 1, maxAge) : 0);
    }
  }
  
  board = temp;
}

function windowResized()
{
  resizeCanvas(windowWidth, windowHeight);
  initBoard();
}

function keyPressed() {
  if (key == 'r') {
    initBoard();
  } else if (key == 's') {
    noLoop();
  } else if (key == 'g') {
    loop();
  }
}
