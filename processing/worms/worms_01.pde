import java.util.Collection;

// ===================
// REGION: Graph Code
// ===================

// Types for building the traversal graph.
class Node<T>
{
  T item;
  ArrayList<Node> neighbors = new ArrayList<Node>();
  
  Node(T x) { item = x; }
  
  String toString()
  {
    String s = item.toString() + "->{";
    
    for (int i = 0; i < neighbors.size(); ++i)
    {
      s += neighbors.get(i).item.toString();
      if (i < neighbors.size() - 1)
        s += ", ";
    }
    
    return s + "}";
  }
}

// Collection of linked Node<T>.
class Graph<T>
{
  HashMap<T, Node<T>> index;
  
  Graph(HashMap<T, Node<T>> itemToNodeMap)
  {
    this.index = itemToNodeMap;
  }
  
  Collection<Node<T>> getNodes() { return index.values(); }
  
  Node<T> getNode(T item) { return index.get(item); }
}

// ENDREGION: Graph Code



//==================
// REGION: Map Code
// =================

final int TK_WALL = 0;
final int TK_PATH = 1;
final int TK_BEGN = 2;
final int TK_GOAL = 3;

// Position of an entry in a GridMap.
class Position
{
  int row;
  int col;
  Position(int r, int c) { row = r; col = c; }
  
  String toString()
  {
    return "(" + col + "," + row + ")"; 
  }
}

// Stores properties of a single cell of a GridMap.
// Used for reference equality of a cell.
class Cell
{
  Tile tile;
  Position pos;
  int score = 0;
  
  Cell(Tile tile, Position pos) { this.tile = tile; this.pos = pos; }
  
  String toString()
  {
    return pos.toString();
  }
}

// Defines the shared properties of a Cell.
class Tile
{  
  int kind;
  color background;
  
  Tile(int kind, color background)
  {
    this.kind = kind;
    this.background = background;
  }
  
  boolean isWall() { return kind == TK_WALL; }
}

// Stores the map array of Cells.
class GridMap
{
  int rowCount;
  int colCount;
  Cell[][] cells;
  Tile[] tiles;
  Cell startCell;
  Cell goalCell;
  
  GridMap(int[][] tileMap, Tile[] tiles)
  {
    rowCount = tileMap.length;
    colCount = tileMap[0].length;
    cells = new Cell[rowCount][colCount];
    
    for (int r = 0; r < rowCount; ++r)
    {
      for (int c = 0; c < colCount; ++c)
      {
        Tile t = tiles[tileMap[r][c]];
        Position p = new Position(r, c);
        cells[r][c] = new Cell(t, p);
        
        if (t.kind == TK_BEGN)
          startCell = cells[r][c];
         else if (t.kind == TK_GOAL)
           goalCell = cells[r][c];
      }
    }
    
    this.tiles = tiles;
  }
  
  Tile getTile(int row, int col)
  {
    Cell c = getCell(row, col);
    return c != null ? c.tile : null;
  }
  
  Cell getCell(int row, int col)
  {
    if (row < 0 || row >= rowCount || col < 0 || col >= colCount)
      return null;

    return cells[(int)row][(int)col];
  }
  
  Cell[] getNeighbors(Cell c)
  {
    Cell[] neighbors = new Cell[8];
    Position p = c.pos;
    
    // Polar style, E first then counter clockwise
    neighbors[0] = getCell(p.row + 1, p.col);     // E
    //neighbors[1] = getCell(p.row + 1, p.col + 1); // NE
    neighbors[2] = getCell(p.row, p.col + 1);     // N
    //neighbors[3] = getCell(p.row - 1, p.col + 1); // NW
    neighbors[4] = getCell(p.row - 1, p.col);     // W
    //neighbors[5] = getCell(p.row - 1, p.col - 1); // SW
    neighbors[6] = getCell(p.row, p.col - 1);     // S
    //neighbors[7] = getCell(p.row + 1, p.col - 1); // SE
    
    return neighbors;
  }
}

// Understands builing a Graph for a GridMap.
class GridGraphBuilder
{
  GridMap map;
  HashMap<Cell, Node<Cell>> nodes =
    new HashMap<Cell, Node<Cell>>();
  
  GridGraphBuilder(GridMap map) { this.map = map; }
  
  Graph<Cell> build()
  { 
    for (int r = 0; r < gMap.rowCount; ++r)
      for (int c = 0; c < gMap.colCount; ++c)
        addCell(r, c);
 
    return new Graph(nodes);
  }
  
  void addCell(int r, int c)
  {
    Cell cell = map.getCell(r, c);
    
    if (cell == null || cell.tile.isWall())
      return;
    
    Node node = getOrAdd(cell);
    Cell[] neighbors = map.getNeighbors(cell);
    
    for (int i = 0; i < neighbors.length; ++i)
    {
      Cell neighbor = neighbors[i];
      if (neighbor == null || neighbor.tile.isWall())
        continue;
      
      
      node.neighbors.add(getOrAdd(neighbor));
    }
  }
  
  Node<Cell> getOrAdd(Cell c)
  {
    Node<Cell> n = nodes.get(c);
    
    if (n == null)
    {
      n = new Node<Cell>(c);
      nodes.put(c, n);
    }
    
    return n;
  }
}

// Map Definitions
// ===============

// Gets a really simple square map.
GridMap getSimpleMap()
{
  Tile[] tiles = {
    new Tile(TK_WALL, color(60)),
    new Tile(TK_PATH, color(255, 10)),
    new Tile(TK_BEGN, color(200, 10)),
    new Tile(TK_GOAL, color(0, 128, 0, 10))
  };
  
  int[][] cells = {
    { 0, 0, 0, 0, 0 },
    { 2, 1, 1, 1, 0 },
    { 0, 1, 0, 1, 0 },
    { 0, 1, 1, 1, 3 },
    { 0, 0, 0, 0, 0 }
  };
  
  return new GridMap(cells, tiles);
}

// Gets a map that requires a real path.
GridMap getObstacleMap()
{
  Tile[] tiles = {
    new Tile(TK_WALL, color(60)),
    new Tile(TK_PATH, color(255, 10)),
    new Tile(TK_BEGN, color(200, 10)),
    new Tile(TK_GOAL, color(0, 128, 0, 10))
  };
  
  int[][] cells = {
    { 0, 2, 0, 0, 0, 0, 0 },
    { 0, 1, 0, 1, 0, 1, 0 },
    { 0, 1, 1, 1, 0, 1, 0 },
    { 0, 1, 1, 1, 1, 1, 0 },
    { 0, 1, 0, 1, 1, 1, 0 },
    { 0, 1, 0, 1, 0, 1, 0 },
    { 0, 0, 0, 0, 0, 3, 0 }
  };
  
  return new GridMap(cells, tiles);
}

// Gets a big map playground.
GridMap getMazeMap()
{
  Tile[] tiles = {
    new Tile(TK_WALL, color(60)),
    new Tile(TK_PATH, color(255, 10)),
    new Tile(TK_BEGN, color(200, 10)),
    new Tile(TK_GOAL, color(0, 128, 0, 10))
  };
  
  int[][] cells = {
    { 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0 },
    { 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0 },
    { 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0 },
    { 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0 },
    { 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 0, 0 },
    { 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0 },
    { 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0 },
    { 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0 },
    { 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0 },
    { 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 3 },
    { 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 }
  };
  
  return new GridMap(cells, tiles);
}

// ENDREGION: Map Code



// ========================  
// REGION: GridMap Helpers
// ========================

// Map Globals
GridMap gMap;
Graph<Cell> gGraph;
int gCellHeight;
int gCellWidth;

// Sets the specified Cell as the goal and updates the
// traversal scores on all Cells in the global GridMap.
void updateDestination(Cell c)
{
  ArrayList<Node<Cell>> unvisited =
    new ArrayList<Node<Cell>>(gGraph.getNodes());
  ArrayList<Node<Cell>> workList =
    new ArrayList<Node<Cell>>();
  
  Node<Cell> dest = gGraph.getNode(c);
  
  if (dest == null)
    throw new RuntimeException("Cell is not part of the the traversal graph.");
  
  dest.item.score = 0;
  workList.add(dest);
  
  while (!workList.isEmpty())
  {
    Node<Cell> n = workList.get(0);
    workList.remove(0);
    unvisited.remove(n);
    
    for (Node<Cell> neighbor : n.neighbors)
    {
      if (unvisited.contains(neighbor))
      {
        neighbor.item.score = n.item.score + 1;
        workList.add(neighbor);
      }
    }
  }
}

// Gets the Cell containing the specified pixel.
Cell getCellAtPoint(int x, int y)
{
  return gMap.getCell(y / gCellHeight, x / gCellWidth);
}

PVector getCellCenter(Cell c)
{
  return new PVector(c.pos.col * gCellWidth + gCellWidth / 2,
                     c.pos.row * gCellHeight + gCellHeight / 2);
}

// ENDREGION: GridMap Helpers



//
// REGION:
// 

// Constants
// =========

// Number of worms to start each iteration.
final int WORM_COUNT = 500;

// Max cap on the number of ticks per generation.
final int GEN_ITER = 50000;

// Radius (in pixels) of the goal area.
final float GOAL_RADIUS = 30;

// Represents the worst possible score.
final float MAX_SCORE = 1000000;


// Returns true if p is within the drawable area.
boolean in_bounds(PVector p)
{
  return p.x >= 0 && p.y >= 0 && p.x < width && p.y < height;  
}

// Returns true if p is in a wall.
boolean in_wall(PVector p)
{
  Cell c = getCellAtPoint((int)p.x, (int)p.y);
  return c == null || c.tile.isWall();
}

// Returns true if p is in the goal area.
boolean at_goal(PVector p)
{
  return dist2(goal, p) <= GOAL_RADIUS / 2;
}

// Get theta constrained to [-PI, PI]
float normalize_theta(float theta)
{
  if (theta > PI)
    theta -= 2 * PI;

  else if (theta < -PI);
    theta += 2 * PI;

  return theta;
}

// 2D distance between two PVectors.
float dist2(PVector a, PVector b)
{
  return dist(a.x, a.y, b.x, b.y);
}

// Get the fitness score for the WormState (lower is better)
float score(WormState s)
{
  // Uses the point when the worm was closes to the goal.
  // Use the Cell score then the distance to compute a total score.
  // TODO: use distance to next better cell?

  Cell c = getCellAtPoint((int)s.pos.x, (int)s.pos.y);

  if (c == null || c.tile.isWall())
    return MAX_SCORE;
  
  return 10000 * c.score + dist2(goal, s.pos);
}

// Equal probability event.
boolean coin_flip()
{
  return random(1) >= 0.5;
}

// Picks a or b depending on a coin flip.
float pick_one(float a, float b)
{
  return coin_flip() ? a : b;
}

// Gets theta constrained to a 360deg / buckets.
float get_quantized_theta(float t, float buckets)
{
  float quant = PI / (buckets / 2);
  float half_quant = quant / 2;
  
  for (float i = -PI; i < PI; i += quant)
    if (abs(t - i) <= half_quant)
      return i;
  
  return PI;
}

// Defines a movement plan for a worm: X ticks in Y direction.
class Behavior
{
  Behavior() { }
  
  Behavior(Behavior other)
  {
    d_theta = other.d_theta;
    count = other.count;
  }
  
  Behavior(float _dt, int _cnt)
  {
    d_theta = _dt;
    count = _cnt;
  }
  
  //float d_theta = random(-PI / 16, PI / 16);
  float d_theta = get_quantized_theta(random(-PI, PI), random(2, 8));
  int count = (int)(random(4, 128));
}

// Copies behaviors from one list to another.
void copyBehaviors(Behavior[] src, Behavior[] dst)
{
  for (int i = 0; i < src.length; ++i)
    dst[i] = new Behavior(src[i]);
}

// The properties that uniquely define a worm when it is "born".
class WormGenes
{
  // TODO:
  // Behavior list length.
}

// The "genes" and state of a worm.
class WormState
{
  PVector pos;
  PVector vel; // x = dir, y = speed
  Behavior[] behaviors = new Behavior[13];
  int idx_bhv = 0;
  int cur_count = 0;  // number of steps in a bahavior direction.
  int dir_mult = 1;   // direction multiplier
  int steps = 0;
  boolean alive = true;
  float min_score = MAX_SCORE;
  int draw_color = color(random(128, 255), 0, random(0, 128));
  
  // Deeply copy this state into the specified state.
  void clone_into(WormState s)
  {
    s.pos = new PVector(pos.x, pos.y);
    s.vel = new PVector(vel.x, vel.y);
    copyBehaviors(behaviors, s.behaviors);
    s.idx_bhv = idx_bhv;
    s.cur_count = cur_count;
    s.dir_mult = dir_mult;
    s.steps = steps;
    s.alive = alive;
    s.min_score = min_score;
    s.draw_color = draw_color;
  }
}

class Worm
{
  WormState init;  // Starting "genes"
  WormState s;     // Current state.
  
  // Starts a new worm at the specified location.
  Worm(PVector start)
  {
    init = new WormState();
    init.pos = new PVector(start.x, start.y);
    init.vel = new PVector(random(-PI, PI), random(1, 4));
    for (int i = 0; i < init.behaviors.length; ++i)
      init.behaviors[i] = new Behavior();
      
    s = new WormState();
    init.clone_into(s);
  }
  
  // Starts a new worm as offspring of the two specified parents.
  Worm(PVector start, Worm parent_a, Worm parent_b)
  {
    init = new WormState();
    init.pos = new PVector(start.x, start.y);
    init.vel = new PVector(pick_one(parent_a.init.vel.x, parent_b.init.vel.x),
                           pick_one(parent_a.init.vel.y, parent_b.init.vel.y));
    copyBehaviors(coin_flip() ? parent_a.init.behaviors : parent_b.init.behaviors, init.behaviors);
    
    mutate();    
    
    s = new WormState();
    init.clone_into(s);
  }
  
  // Mutates the movement properties of the worm.
  void mutate()
  {
    init.vel.x *= (1 + random(-mutation_factor, mutation_factor));
    init.vel.y *= (1 + random(-mutation_factor, mutation_factor));
    
    for (int i = 0; i < init.behaviors.length; ++i)
    {
      init.behaviors[i].d_theta *= (1 + random(-mutation_factor, mutation_factor));
      init.behaviors[i].count *= (1 + random(-mutation_factor, mutation_factor));
      
      // Randomize the end behaviors a little more.
      if (random(1) < (i / 100))
        init.behaviors[i].d_theta = normalize_theta(init.behaviors[i].d_theta + random(-PI, PI));
    }
  }
  
  // Advance the worm one tick in the simulation.
  // Returns true if the work is still "alive".
  boolean tick()
  {
    if (!s.alive)
      return false;

    move();
    s.steps++;

    float cur_score = score(s);
    if (cur_score < s.min_score)
      s.min_score = cur_score;

    s.alive = in_bounds(s.pos) && !in_wall(s.pos);
    if (at_goal(s.pos))
    {
      println("WIN");
      noLoop();
    }
      
    return s.alive;
  }
  
  // Move the worm to its new position given its current velocity.
  void move()
  {
    // TODO: actually move the correct distance
    s.pos.x += cos(s.vel.x) * s.vel.y;
    s.pos.y += sin(s.vel.x) * s.vel.y;
    //s.vel.x = normalize_theta(s.vel.x + (s.dir_mult * s.behaviors[s.idx_bhv].d_theta));
    s.vel.x = normalize_theta(s.vel.x + (s.dir_mult * PI / 360));
    
    if (--s.cur_count < 0)
    {
      s.idx_bhv = (s.idx_bhv + 1) % s.behaviors.length;
      s.vel.x = s.behaviors[s.idx_bhv].d_theta * s.dir_mult;
      
      s.cur_count = s.behaviors[s.idx_bhv].count;
      s.dir_mult *= -1;
    }
  }
  
  // Resets the worm to its "genes".
  void reset()
  {
    init.clone_into(s);
    s.draw_color = color(0, 255, 255);
  }
}

// Worm Globals
// ============
ArrayList<Worm> worms = new ArrayList<Worm>();
float mutation_factor;
float last_best = 0;
int cur_iter = 0;
int retry_limit = 10;
int retry_count = 0;
PVector center;
PVector goal;

// Setup the screen and world.
void setup()
{
  size(800, 800);
  prepare_map();
  prepare_first_run();
}

void prepare_map()
{
  //gMap = getSimpleMap();
  //gMap = getObstacleMap();
  gMap = getMazeMap();
  GridGraphBuilder builder = new GridGraphBuilder(gMap);
  gGraph = builder.build();
  
  print("Graph node count: ");
  println(gGraph.getNodes().size());
  for (Node n : gGraph.getNodes())
    println(n.toString());
    
  gCellHeight = height / gMap.rowCount;
  gCellWidth = width / gMap.colCount;

  updateDestination(gMap.goalCell);
  goal = getCellCenter(gMap.goalCell);
  center = getCellCenter(gMap.startCell);
}

void prepare_first_run()
{
  println("Starting new species");
  cur_iter = GEN_ITER;
  retry_count = 0;
  worms.clear();

  for (int i = 0; i < WORM_COUNT; ++i)
    worms.add(new Worm(center));
}

void prepare_incr_run()
{
    cur_iter = GEN_ITER;
  
  // find the two most successful
  Worm parent_a = (Worm)worms.get(0);
  Worm parent_b = (Worm)worms.get(1);
  
  for (int i = 1; i < worms.size(); ++i)
  {
    Worm w = worms.get(i);
    
    if (w.s.min_score < parent_a.s.min_score)
    {
      parent_b = parent_a;
      parent_a = w;
    }
  }
  
  // Mutation factor is based on how well we are tracking toward goal.
  float cur_best = parent_a.s.min_score;
  float delta_best = abs(cur_best - last_best);
  last_best = cur_best;
  float log_delta = log(delta_best);
  mutation_factor = 0.01 + ((float)retry_count / retry_limit) * 0.15;
  println("Delta: " + delta_best, "Log Delta: " + log_delta,
          "Retry: " + retry_count, "Mutation: " + mutation_factor);
  
  // If we've made progress, reset the retry count.
  if (log_delta > 3)
    retry_count = 0;
  else
    ++retry_count;
  
  if (retry_count < retry_limit)
  {
    // try again with the two best worms as seeds.
    worms.clear();
    for (int i = 0; i < WORM_COUNT - 2; ++i)
      worms.add(new Worm(center, parent_a, parent_b));
      
    parent_a.reset();
    parent_b.reset();
    worms.add(parent_a);
    worms.add(parent_b);
  }
  else
  {
    // no progress, start over
    prepare_first_run();
  }
}

void draw()
{  
  boolean any_alive = false;
  
  // Draw map.
  stroke(0);
  for (int r = 0; r < gMap.rowCount; ++r)
  {
    for (int c = 0; c < gMap.colCount; ++c)
    {
      Cell cell = gMap.getCell(r, c);
      fill(cell.tile.background);
      rect(c * gCellWidth, r * gCellHeight, gCellWidth, gCellHeight);
      
      if (!cell.tile.isWall())
      {
        fill(128);
        PVector loc = getCellCenter(cell);
        text(cell.score, loc.x, loc.y);
      }
    }
  }
  
  // Draw goal.
  stroke(0, 255, 0);
  fill(0, 200, 0);
  ellipse(goal.x, goal.y, GOAL_RADIUS, GOAL_RADIUS);
  
  // Draw and update worms.
  for (Worm w : worms)
  {
    if (!w.s.alive) continue;
   
    stroke(w.s.draw_color);
    ellipse((int)w.s.pos.x, (int)w.s.pos.y, 1, 1);

    if (w.tick())
      any_alive = true;
  }
  
  // Draw fade.
  stroke(200);
  fill(200, 2);
  rect(0, 0, width, height);

  // If all are dead or we stalled, start the next iteration.
  if (!any_alive || --cur_iter < 0)
  {
    // Clear screen.
    stroke(200);
    fill(200);
    rect(0, 0, width, height);

    prepare_incr_run();
    
    // Draw stats.
    fill(0);
    text(last_best, 10, 12);
    text(mutation_factor, 10, 24);
  }
}

void mouseClicked()
{
  if (mouseButton == LEFT)
  {
    center = new PVector(mouseX, mouseY);
  }
  else if (mouseButton == RIGHT)
  {
    goal = new PVector(mouseX, mouseY);
    updateDestination(getCellAtPoint((int)goal.x, (int)goal.y));
  }
  
  // Restart simulation.
  prepare_first_run();
  loop();
}

void keyPressed()
{
  // Force next iteration.
  if (key == ' ')
    cur_iter = 0;
  
  // Restart simulation.
  else if (key == 'r')
  {
    prepare_first_run();
    loop();
  }
}
