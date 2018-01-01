
//
// Draw a circle of radius r at point p
//
void circle(PVector p, float r)
{
    ellipse(p.x, p.y, r, r);
}

//
// Get theta constrained to [-PI, PI]
//
float normalizeTheta(float theta)
{
    if (theta > PI)
        theta -= 2 * PI;

    else if (theta < -PI);
        theta += 2 * PI;

    return theta;
}

//
// Maps a theta value to the screen coordinate system
//
float mapTheta(float theta)
{
    return -normalizeTheta(theta);
}

//
// Reflect theta over the Y axis
//
float reflectOverY(float theta)
{
    theta = normalizeTheta(theta);
        return theta > 0
        ? PI - theta
        : -PI - theta;
}

//
// Reflect theta over the X axis
//
float reflectOverX(float theta)
{
    return -theta;
}

//
// Find the angle to a point
//
float angleTo(PVector from, PVector to)
{
    float dx = to.x - from.x;
    float dy = to.y - from.y;

    return atan2(dy, dx);
}

//
// Constrain an int value with wrapping [min, max)
//
int constrain_i(int x, int min, int max)
{
    if (x < min || x >= max)
        x = x < min
            ? max + x
            : x - max;

    return x;
}

//
// Constrain an int value to [min, max)
//
int clamp_i(int x, int min, int max)
{
    if (x < min || x >= max)
        x = x < min ? min : (max - 1);

    return x;
}

//
// Constrain a value to a +/-(range / 2) centered at the base
//
int constrainToRange(int val, int base, int range)
{
    int half = range / 2;
    int maxVal = base + half;
    int minVal = maxVal - range;

    if (val < minVal || val >= maxVal)
        return val < minVal
            ? val + range
            : val - range;

    return val;
}

//
// Unwrap a point and translate to an offset of origin
//
PVector recenterPoint(PVector origin, PVector point)
{
    return new PVector(constrainToRange(point.x, origin.x, width), constrainToRange(point.y, origin.y, height));
}

//
// 2D distance between two PVectors
//
float dist2(PVector a, PVector b)
{
    return dist(a.x, a.y, b.x, b.y);
}

//
// Distance between bugs that takes size into account
//
float dist3(Bug a, Bug b)
{
    return dist2(a.getPosition(), a.getRelativePosition(b)) - a.getSize() - b.getSize();
}

//
// Mutate a value in a random direction up to the jitterPercent [0, 1.0]
//
float mutateValue(float value, float jitterPercent)
{
    float jitter = abs(value) * jitterPercent;
    return value + random(-jitter, jitter);
}

int mutateColor(int c, float jitterPercent)
{
    int r = constrain_i(mutateValue((c >> 16) & 0xFF, jitterPercent), 0x60, 0xFF);
    int g = constrain_i(mutateValue((c >> 8) & 0xFF, jitterPercent), 0x60, 0xFF);
    int b = constrain_i(mutateValue(c & 0xFF, jitterPercent), 0x60, 0xFF);

    return 0xFF000000 + (r << 16) + (g << 8) + b;
}

//
// Finds the radius of a circle with the sum
// of the area of the two given radiuses
//
float addAreas(float r1, float r2)
{
    float a1 = PI * sq(r1);
    float a2 = PI * sq(r2);
    return sqrt((a1 + a2) / PI);
}

float subtractAreas(float r1, float r2)
{
    float larger = max(r1, r2);
    float smaller = min(r1, r2);
    float a1 = PI * sq(larger);
    float a2 = PI * sq(smaller);

    if (a1 <= a2)
        return 0;

    return sqrt((a1 - a2) / PI);
}

float divideArea(float r, float div)
{
    return sqrt(sq(r) / div);
}

int getPotentialChildCount(float r, float rChild)
{
    float a = PI * sq(r);
    float aChild = PI * sq(rChild);
    return (int)(a / aChild);
}

PVector randomPoint(PVector p, float size)
{
    return new PVector(
        p.x + random(-size, size),
        p.y + random(-size, size));
}

final int OTHER = 0; 
final int PREDATOR = 1;
final int PREY = 2;
final int CORPSE = 3;
final int SIBLING = 4;

class BugDist
{
    BugDist(Bug b, float d)
    {
        bug = b;
        distance = d;
    }

    Bug bug;
    float distance;
}

//
// Quick sort a list of BugDist objects
//
ArrayList sortBugDist(ArrayList l)
{
    if (l.size() < 2) return l;

    ArrayList ret = new ArrayList();
    ArrayList lower = new ArrayList();
    ArrayList higher = new ArrayList();

    BugDist mid = (BugDist)l.get(0);

    // skip the first
    for (int i = 1; i < l.size(); ++i)
    {
        BugDist cur = (BugDist)l.get(i);
        if (cur.distance < mid.distance)
            lower.add(cur);
        else
            higher.add(cur);
    }

    ret.addAll(sortBugDist(lower));
    ret.add(mid);
    ret.addAll(sortBugDist(higher));

    return ret;
}


//
// State about an individual bug
//
class Bug
{
    // need to have some variables affecting
    // movement and goal seeking - the variables
    // for each should be random but constrained
    // to some max and should be inheritable.

    // maybe a total energy quota that is subtracted
    // from when ever there's an action
    // TOOD: compute POWER needed for an action.
    // Moving quickly should use more energy.

    static int nextSpecies = 0;
    static int spawnTotal = 0;

    PVector position;
    int species;
    int generation;

    // parameters
    float energy;
    boolean alive;
    boolean eaten;
    float mutationRate;

    float size;
    float spawnSize;
    int color_;

    float senseRadius;
    float fight;
    float flight;
    float feed;
    float fuck;
    float maxMove;
    float wiggle;
    float direction;
    float baseMetabolism;

    Bug()
    {
        ++spawnTotal;
        position = new PVector(random(1, 800), random(1, 800));
        species = nextSpecies++;
        generation = 1;

        energy = 100.0;
        alive = true;
        eaten = false;
        mutationRate = random(0.01, 0.1);

        spawnSize = random(1.0, 3.0);
        size = spawnSize;
        color_ = 0xFF000000 + (int)random(0x606060, 0xFFFFFF);

        senseRadius = random(15.0, 30.0);
        fight = random(0.5, 1.5);
        flight = random(0.5, 1.5);
        feed = random(0.5, 1.5);
        fuck = random(1.5, 3.0);
        maxMove = 4.0 - spawnSize;
        wiggle = random(PI / 64, PI / 8);
        direction = mapTheta(random(-PI, PI));

        baseMetabolism = random(spawnSize / 2);
    }

    Bug(Bug parent)
    {
        ++spawnTotal;
        generation = parent.generation + 1;
        species = parent.species;

        if (generation > 10)
        {
            generation = 1;
            species = nextSpecies++;
        }

        position = randomPoint(parent.position, parent.size);

        energy = 100.0;
        alive = true;
        eaten = false;
        spawnSize = mutateValue(parent.spawnSize, parent.mutationRate);
        size = spawnSize;
        color_ = mutateColor(parent.color_, parent.mutationRate);

        senseRadius = mutateValue(parent.senseRadius, parent.mutationRate);
        fight = mutateValue(parent.fight, parent.mutationRate);
        flight = mutateValue(parent.flight, parent.mutationRate);
        feed = mutateValue(parent.feed, parent.mutationRate);
        fuck = mutateValue(parent.fuck, parent.mutationRate);
        maxMove = mutateValue(parent.maxMove, parent.mutationRate);
        wiggle = mutateValue(parent.wiggle, parent.mutationRate);
        direction = mapTheta(random(-PI, PI));

        baseMetabolism = mutateValue(parent.baseMetabolism, parent.mutationRate);
    }

    void render()
    {
        stroke(alive ? color_ : 0xFF333333);
        circle(position, size);

        float dirX = position.x + cos(direction) *  size;
        float dirY = position.y + sin(direction) * size;
        line(position.x, position.y, dirX, dirY);
    }

    void update(ArrayList neighbors)
    {
        if (!alive) return;

        PVector initial = position;

        if (neighbors.size() > 0)
            takeAction(neighbors);
        else
            randomWalk();

        // fix up location and update energy
        constrainBounds();
        energy -= baseMetabolism;
        energy -= sq(size) * dist(initial.x, initial.y, position.x, position.y);

        alive = energy > 0;
    }

    ArrayList spawn()
    {
        ArrayList ret = new ArrayList();

        if (size > (spawnSize * fuck) || (alive && size > spawnSize && bugs.size() < 250))
        {
            float newSize = mutateValue(divideArea(size, 2), 0.25);
            Bug child = new Bug(this);

            // jitter the resulting size
            child.size = subtractAreas(size, newSize);
            size = newSize;

            ret.add(child);
        }

        return ret;
    }

    void randomWalk()
    {
        jitterDirection(wiggle);

        // don't want to burn too much energy wandering around
        float wanderRate = getMaxMove() / 3.0;
        move(wanderRate);
    }

    void takeAction(ArrayList neighbors)
    {
        // assumes neighbors is a list of BugDist with closest first
        BugDist bugDist = (BugDist)neighbors.get(0);
        int kind = classify(bugDist.bug);
        float distance = bugDist.distance;
        float moveSpeed = getMaxMove();
        direction = angleTo(position, getRelativePosition(bugDist.bug));

        // special handling
        switch (kind)
        {
            case PREDATOR:
            case SIBLING:
            case OTHER:
                direction = normalizeTheta(direction + PI);
                break;

            case PREY:
            case CORPSE:
                if (distance <= 0)
                 eat(bugDist.bug);
        }

        // update moveSpeed
        switch (kind)
        {
            case PREDATOR:
                moveSpeed *= flight;
                break;

            case PREY:
                moveSpeed *= fight;
                break;

            case CORPSE:
                moveSpeed *= feed;
                break;

            case SIBLING:
            case OTHER:
                moveSpeed = random(0, moveSpeed);
        }

        jitterDirection(wiggle / 4);
        move(moveSpeed);
    }

    void eat(Bug b)
    {
        energy += b.size * 2 + (b.energy > 0 ? b.energy : 0);
        size = addAreas(size, b.size);

        b.energy = 0;
        b.alive = false;
        b.eaten = true;
    }

    int classify(Bug bug)
    {
        if (!bug.alive)
            return CORPSE;

        else if (species == bug.species)
            return SIBLING;

        else if (bug.size < size)
            return PREY;

        else if (bug.size > size)
            return PREDATOR;

        return OTHER;
    }

    void jitterDirection(float jitterPercent)
    {
        direction = normalizeTheta(mutateValue(direction, jitterPercent));
    }

    void move(float distance)
    {
        // TODO: actually move the correct distance
        position.x += cos(direction) * distance;
        position.y += sin(direction) * distance;
    }

    void constrainBounds()
    {
        float minX = 0;
        float minY = 0;
        float maxX = width;
        float maxY = height;

        if (position.x < minX || position.x > maxX)
        {
            position.x = position.x < minX
                ? maxX + position.x // position is negative here
                : position.x - maxX;
        }

        if (position.y < minY || position.y > maxY)
        {
            position.y = position.y < minY
                ? maxY + position.y // position is negative here
                : position.y - maxY;
        }
    }

    //
    // Get the other Bug's location relative to this Bug
    //
    PVector getRelativePosition(Bug other)
    {
        return recenterPoint(position, other.position);
    }

    float getSize() { return size; }
    float getMaxMove() { return maxMove; }
    PVector getPosition() { return position; }
    float getSenseRadius() { return senseRadius + size; }
    boolean isAlive() { return alive; }
    boolean isEaten() { return eaten; }
}

// Shared data
final int initialBugCount = 500;
ArrayList bugs = new ArrayList();
final int initialWidth = 800;
final int initialHeight = 800;
boolean debug = false;

//
// Index of bug locations to make searching faster
//
class BugIndex
{
    final int resolution = 10;
    final int indexCols = initialWidth / resolution;
    final int indexRows = initialHeight / resolution;
    ArrayList[][] index = new ArrayList[indexCols][indexRows];

    BugIndex()
    {
        for (int i = 0; i < indexCols; ++i)
        for (int j = 0; j < indexRows; ++j)
            index[i][j] = new ArrayList();

        console.log("Index dimensions: " + indexCols + ", " + indexRows);
    }

    void clear()
    {
        for (int i = 0; i < indexCols; ++i)
        for (int j = 0; j < indexRows; ++j)
            index[i][j].clear();
    }

    //
    // Get a PVector containing the col, row of the item in the index
    //
    PVector quantize(PVector p)
    {
        float x = p.x / resolution;
        float y = p.y / resolution;

        x = clamp_i(x, 0, indexCols);
        y = clamp_i(y, 0, indexRows);

        return new PVector((int)x, (int)y);
    }

    void add(Bug b)
    {
        PVector p = quantize(b.getPosition());
        index[(int)p.x][(int)p.y].add(b);
    }

    void remove(Bug b)
    {
        PVector p = quantize(b.getPosition());
        index[(int)p.x][(int)p.y].remove(b);
    }

    //
    // Get an ArrayList of all bugs within radius r
    //
    ArrayList getNeighbors(Bug b, float r)
    {
        ArrayList ret = new ArrayList();
        PVector pq = quantize(b.getPosition());
        int rq = ceil(r / resolution);
        boolean showDebugGrid = b == bugs.get(0) && debug;

        if (showDebugGrid)
        {
            fill(0, 0);
            stroke(0, 255, 255);
            circle(b.getPosition(), r); 
        }

        for (int i = pq.x - rq; i <= pq.x + rq; ++i)
        {
            for (int j = pq.y - rq; j <= pq.y + rq; ++j)
            {
                int col = constrain_i(i, 0, indexCols);
                int row = constrain_i(j, 0, indexRows);
                ArrayList cellItems = index[col][row];

                if (showDebugGrid)
                {
                    stroke(255, 0, 255, 64);
                    rect(col * resolution, row * resolution, resolution, resolution);
                }

                for (int k = 0; k < cellItems.size(); ++k)
                {
                    // TODO: pull out isEaten filter
                    Bug b2 = (Bug)cellItems.get(k);
                    float d = dist3(b, b2);

                    if (d <= r && !b2.isEaten())
                    {
                        ret.add(new BugDist(b2, d));

                        if (showDebugGrid)
                        {
                            pushStyle();
                            stroke(255, 0, 0);
                            fill(255, 0, 0, 255);
                            circle(b2.getPosition(), b2.getSize());
                            popStyle();
                        }
                    }
                }
            }
        }

        ArrayList sorted = sortBugDist(ret);
        if (showDebugGrid && sorted.size() > 0)
        {
            BugDist bd = (BugDist)sorted.get(0);
            pushStyle();
            stroke(255, 255, 0);
            fill(255, 255, 0, 255);
            circle(bd.bug.getPosition(), bd.bug.getSize());
            popStyle();
        }

        return sorted;
    }
}

BugIndex bugIndex = new BugIndex();

void setup()
{
    size(800, 800);
    frameRate(30);
    smooth();
    background(0);
    strokeWeight(1);
    ellipseMode(RADIUS);

    addNewBugs(initialBugCount);

    PFont fontA = loadFont("courier");
    textFont(fontA, 14);
}

void draw()
{
    stroke(0);
    fill(0, 32);
    rect(0, 0, width, height);

    // update bugs
    for (int i = 0; i < bugs.size(); )
    {
        Bug b = (Bug)bugs.get(i);

        if (b.isEaten())
        {
            // delete this bug and continue
            bugs.remove(i);
            bugIndex.remove(b);
            continue;
        }

        // keep the index up to date along the way
        // remove the current bug before updating it
        bugIndex.remove(b);
        ArrayList neighbors = bugIndex.getNeighbors(b, b.getSenseRadius());

        b.update(neighbors);
        b.render();

        // new bugs are spawned
        ArrayList children = b.spawn();
        for (int j = 0; j < children.size(); ++j)
        {
            bugs.add(children.get(j));
            bugIndex.add(children.get(j));
        }

        // re-add the updated bug
        bugIndex.add(b);

        // manually walk the index
        ++i;
    }

    if (debug)
    {
        stroke(255);
        fill(255);
        text(bugs.size(), 14, 765);
        text(Bug.spawnTotal, 14, 780);
    }
}

void addNewBugs(int count)
{
    for (int i = 0; i < count; ++i)
    {
        // TODO: can we converge the index and storage
        Bug b = new Bug();
        bugs.add(b);
        bugIndex.add(b);
    }
}

void keyPressed()
{
    if (key == ' ')
        addNewBugs(50);
    else if (key == 'p')
        noLoop();
    else if (key == 'r')
        loop();
    else if (key == 'd')
        debug = !debug;
}

void mouseClicked()
{
    debug = !debug;
}

