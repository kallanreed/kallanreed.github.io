let cos30 = Math.cos(Math.PI / 6);
let sin30 = Math.sin(Math.PI / 6);

function hexa(x, y, rad) {
  quad(x, y - rad, x + rad * cos30, y - rad * sin30, x + rad * cos30, y + rad * sin30, x, y + rad);
  quad(x, y - rad, x - rad * cos30, y - rad * sin30, x - rad * cos30, y + rad * sin30, x, y + rad);
}

let maxAge = 30;
let cellRad = 5;
let colWidth = 2 * cellRad * cos30;
let rowHeight = cellRad + cellRad * sin30;
var distNeighborFactor = 1.0;
var lifeFunc = (a, n) => n == 4 || (n > 1 && n < 5 && a > 0);
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
         fn(col - 1, row - 2) + fn(col + 1, row - 2) +  // Finish top and bottom.
         fn(col - 1, row + 2) + fn(col + 1, row + 2) +
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
         floor(distantNeighborCount(col, row) / distNeighborFactor);
}

function aliveNext(age, neighbors)
{
  return lifeFunc(age, neighbors);
}

function scoreBoard() {
  
  var old = 0;
  var young = 0;
  var dead = 0;
  
  for (var i = 0; i < board.length; i++) {
    if (board[i] == 0) {
      dead++;
    } else if (board[i] > (maxAge * 0.25)) {
      old++;
    } else {
      young++;
    }
  }
  
  // Want to maximize young cells up to some % of the board
  // lower score the better
  var target = board.length * 0.05;
  var score = abs(target - young) - old * 0.2;
  console.log("DNF: " + distNeighborFactor + " Dead: " + dead +
    " Young: " + young + " Old: " + old + " Score: " + score);
  return score;
}

function runIterations(iterCount) {
  while (iterCount-- > 0) {
    let temp = [];
  
    for (var r = 0; r < rows; r++) {
      // Every other row needs to be shifted.
      let offset = (r & 1) == 1 ? colWidth / 2 : 0;
      for (var c = 0; c < cols; c++) {
        let age = cellAge(c, r);
        let nc = neighborCount(c, r);
        
        temp.push(aliveNext(age, nc) ? min(age + 1, maxAge) : 0);
      }
    }
    
    board = temp;
  }
}

function findParameters() {
  noLoop();
  initBoard();
  
  let startingBoard = Array.from(board);
  var bestValue = 0;
  var bestScore = 99999;
  
  for (var i = 1.5; i < 2.5; i += 0.05) {
    distNeighborFactor = i;
    runIterations(100);
    var score = scoreBoard();
    
    if (score < bestScore) {
      bestScore = score;
      bestValue = i;
    }
    
    board = Array.from(startingBoard);
  }
  
  console.log("Best: " + bestValue + " Score: " + bestScore);
}

function initBoard() {
  cols = ceil(width / colWidth);
  rows = ceil(height / rowHeight);
  
  board = [];
  for (var r = 0; r < rows; r++) {
    for (var c = 1; c < cols; c++) {
      board.push(random() < 0.8 ? 0 : 1);
    }
  }
}

var dnfInput;
var lifeFuncInput;
var resetButton;
var pauseButton;

function dnfUpdate() {
  distNeighborFactor = float(this.value());
  console.log("New DNF: " + distNeighborFactor);
}

function lifeFuncUpdate() {
  lifeFunc = eval(this.value());
  console.log("New LF: " + str(lifeFunc));
}

function resetClicked() {
  initBoard();
}

function pauseClicked() {
  if (isLooping()) {
    noLoop();
  } else {
    loop();
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  lifeFuncInput = createInput(str(lifeFunc));
  lifeFuncInput.position(0, 0);
  lifeFuncInput.size(width);
  lifeFuncInput.input(lifeFuncUpdate);
  
  dnfInput = createInput(str(distNeighborFactor));
  dnfInput.position(0, 20);
  dnfInput.size(30);
  dnfInput.input(dnfUpdate);
  
  resetButton = createButton('Randomize');
  resetButton.position(35, 22);
  resetButton.mousePressed(resetClicked);
  
  pauseButton = createButton('Pause');
  pauseButton.position(110, 22);
  pauseButton.mousePressed(pauseClicked);
  
  initBoard();
  frameRate(12);
  
  // 'map' is too slow to have in the tight loop so pre-compute this.
  for (var i = 0; i < maxAge; i++) {
    colorMap.push(floor(map(i, 0, maxAge, 255, 64)));
  }
  
  //findParameters();
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
