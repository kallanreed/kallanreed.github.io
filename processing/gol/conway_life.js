let maxAge = 100;
let colWidth = 4;
let rowHeight = 4;
var cols = 0;
var rows = 0;
var blur = false;
var board = [];
var colorMap = [];


function cellAge(col, row) {
  
  if (col < 0 || col >= cols || row < 0 || row >= rows) {
      return 0;
   }
  
  let index = row * cols + col;
  return board[index];
}

function neighborCount(col, row) {
  let fn = (c, r) => cellAge(c, r) > 0 ? 1 : 0;
  
  return fn(col - 1, row - 1) + fn(col, row - 1) + fn(col + 1, row - 1) +
         fn(col - 1, row    ) +                    fn(col + 1, row    ) +
         fn(col - 1, row + 1) + fn(col, row + 1) + fn(col + 1, row + 1);
}

function aliveNext(age, neighbors)
{
  return (neighbors >= 2 && neighbors <= 3 && age > 0) ||
         (neighbors == 3 && age == 0);
}

function mouseIndex() {
  return floor(mouseY / rowHeight) * cols + floor(mouseX / colWidth);
}

function initBoard() {
  cols = floor(width / colWidth);
  rows = floor(height / rowHeight);
  
  board = [];
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      board.push(random() > 0.6 ? 0 : floor(random(1, maxAge / 2)));
    }
  }
}

function renderBoard(fn) {
  noStroke();
  
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      let age = cellAge(c, r);
      let nc = neighborCount(c, r);
      
      if (age > 0) {
        fill(colorMap[age - 1]);
        rect(c * colWidth, r * rowHeight, colWidth, rowHeight);
      }
      
      fn(age, nc);
    }
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight); 
  initBoard();
  
  frameRate(15);
  
  // 'map' is too slow to have in the tight loop so pre-compute this.
  for (var i = 0; i < maxAge; i++) {
    colorMap.push(floor(map(i, 0, maxAge, 255, 64)));
  }
  
  console.log("s: stop");
  console.log("g: go");
  console.log("r: reset");
  console.log(">: faster");
  console.log("<: slower");
  console.log("b: blur");
}

function draw() {
  if (blur) {
    fill(0, 25);
    rect(0, 0, width, height);
  } else {
    background(0);
  }
  
  if (isLooping()) {
    let temp = [];
    let update = (age, nc) => {
      temp.push(aliveNext(age, nc) ? min(age + 1, maxAge) : 0);
    };
  
    renderBoard(update);
    board = temp;
  } else {
    // 'redraw' case.
    renderBoard((a, n) => { });
  }
}

function windowResized()
{
  resizeCanvas(windowWidth, windowHeight);
  initBoard();
}

function mousePressed() {
  noLoop();
}

function mouseDragged() {
  board[mouseIndex()] = 1;
  redraw();
}

function mouseReleased() {
  loop();
}

function keyPressed() {
  if (key == 'r') {
    initBoard();
  } else if (key == 's') {
    noLoop();
  } else if (key == 'g') {
    loop();
  } else if (key == '>') {
    frameRate(frameRate() + 1);
  } else if (key == '<') {
    frameRate(frameRate() - 1);
  } else if (key == 'b') {
    blur = !blur;
  }
}
