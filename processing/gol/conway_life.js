let width = 900;
let height = 900;
let colWidth = 3;
let rowHeight = 3;
let cols = width / colWidth;
let rows = height / rowHeight;

var board = [];

function hasCell(col, row) {
  
  if (col < 0 || col >= cols || row < 0 || row >= rows) {
      return false;
   }
  
  let index = row * cols + col;
  return board[index];
}

function neighborCount(col, row) {
  let fn = (c, r) => hasCell(c, r) ? 1 : 0;
  
  return fn(col - 1, row - 1) + fn(col, row - 1) + fn(col + 1, row - 1) +
         fn(col - 1, row    ) +                    fn(col + 1, row    ) +
         fn(col - 1, row + 1) + fn(col, row + 1) + fn(col + 1, row + 1);
}

function aliveNext(alive, neighbors)
{
  return (neighbors >= 2 && neighbors <= 3 && alive) ||
         (neighbors == 3 && !alive);
}

function mouseIndex() {
  return index = Math.floor(mouseY / rowHeight) * cols + Math.floor(mouseX / colWidth);
}

function initBoard() {
  board = [];
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      board.push(random() > 0.5);
    }
  }
}

function setup() {
  createCanvas(width, height);
  frameRate(15);
  initBoard();
  console.log(board);
}

function draw() {
  background(0);
  noStroke();
  fill(200);
  
  let temp = [];
  
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      let alive = hasCell(c, r);
      let nc = neighborCount(c, r);
      
      if (alive) {
        rect(c * colWidth, r * rowHeight, colWidth, rowHeight);
      }
      
      temp.push(aliveNext(alive, nc));
    }
  }
  
  board = temp;
  
  if (mouseIsPressed) {
    board[mouseIndex()] = true;
  }
}

function mousePressed() {
  // TODO: redraw w/o update
  board[mouseIndex()] = true;
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
