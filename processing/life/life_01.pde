// (c) Kyle Reed

//
// Draw a circle of radius r at point p
//
void circle(PVector p, float r)
{
    ellipse(p.x - r, p.y - r, 2 * r, 2 * r);
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

float dist2(PVector a, PVector b)
{
    return dist(a.x, a.y, b.x, b.y);
}

//
// Mutate a value in a random direction up to the jitterPercent [0, 1.0]
//
float mutateValue(float value, float jitterPercent)
{
    float jitter = abs(value) * jitterPercent;
    return value + random(-jitter, jitter);
}

PVector randomPoint(PVector p, float size)
{
    return new PVector(
        p.x + random(-size, size),
        p.y + random(-size, size));
}

class NeighborInfo
{
    Bug predator;
    Bug prey;
    Bug corpse;
    Bug any;
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
        mutationRate = random(0.01, 0.05);

        size = random(1.0, 3.0);
        spawnSize = size;
        color_ = 0xFF000000 + (int)random(0x606060, 0xFFFFFF);

        senseRadius = random(10.0, 30.0);
        fight = random(1.0);
        flight = random(1.0);
        feed = random(1.0);
        fuck = random(1.0);
        maxMove = (3.0 - size);
        direction = mapTheta(random(-PI, PI));

        baseMetabolism = random(1.0) / 10.0 * size;
    }

    Bug(Bug parent)
    {
        ++spawnTotal;
        position = randomPoint(parent.position, parent.size);
        species = parent.species;
        generation = parent.generation + 1;

        energy = 100.0;
        alive = true;
        eaten = false;
        size = mutateValue(parent.spawnSize, parent.mutationRate);
        spawnSize = size;
        color_ = parent.color_;

        senseRadius = mutateValue(parent.senseRadius, parent.mutationRate);
        fight = mutateValue(parent.fight, parent.mutationRate);
        flight = mutateValue(parent.flight, parent.mutationRate);
        feed = mutateValue(parent.feed, parent.mutationRate);
        fuck = mutateValue(parent.fuck, parent.mutationRate);
        maxMove = mutateValue(parent.maxMove, parent.mutationRate);
        direction = mapTheta(random(-PI, PI));

        baseMetabolism = mutateValue(parent.baseMetabolism, parent.mutationRate);
    }

    void render()
    {
        stroke(alive ? color_ : 0xFF333333);
        circle(position, size);
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
        energy -= dist(initial.x, initial.y, position.x, position.y);

        alive = energy > 0;
    }

    ArrayList spawn()
    {
        ArrayList ret = new ArrayList();

        if (size < spawnSize * 5)
            return ret;

        while (size > spawnSize * 2)
        {
            Bug child = new Bug(this);
            size -= child.spawnSize;

            // Subtract energy?

            ret.add(child);
        }

        return ret;
    }

    void randomWalk()
    {
        jitterDirection(0.125);

        // don't want to burn too much energy wandering around
        float wanderRate = maxMove / 3.0;
        move(wanderRate);
    }

    void takeAction(ArrayList neighbors)
    {
        // TODO: need to figure out a way to introduce the four Fs
        // so we can have heritable traits to pass on

        NeighborInfo ni = classifyNeighbors(neighbors);

        if (ni.predator != null)
        {
            direction = angleTo(position, ni.predator.position);

            // run away from predators first
            direction = normalizeTheta(direction + PI);
        }
        else if (ni.corpse != null)
        {
            direction = angleTo(position, ni.corpse.position);

            if (dist2(position, ni.corpse.position) <= size)
                eat(ni.corpse);
        }
        else if (ni.prey != null)
        {
            direction = angleTo(position, ni.prey.position);

            if (dist2(position, ni.prey.position) <= size)
                eat(ni.prey);
        }
        else if (ni.any != null)
        {
            // run away from crowding
        }

        jitterDirection(0.05);
        move(maxMove);
    }

    void eat(Bug b)
    {
        energy += b.size * 5 + (b.energy > 0 ? b.energy : 0);
        size += b.size; // TODO: conserve volume

        b.energy = 0;
        b.alive = false;
        b.eaten = true;
    }

    NeighborInfo classifyNeighbors(ArrayList neighbors)
    {
        // TODO: get _nearest_ for each category, pre-sort
        NeighborInfo ni = new NeighborInfo();

        for (int i = 0; i < neighbors.size(); ++i)
        {
            Bug n = (Bug)neighbors.get(i);

            if (ni.corpse == null && !n.alive)
                ni.corpse = n;
            else if (ni.prey == null && n.size < size && n.species != species)
                ni.prey = n;
            else if (ni.predator == null && n.size < size && n.species != species)
                ni.predator = n;
            else if (ni.any == null)
                ni.any = n;

        }

        return ni;
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
            position.x = position.x < minX ? minX : maxX;
            direction = reflectOverY(direction);
        }

        if (position.y < minY || position.y > maxY)
        {
            position.y = position.y < minY ? minY : maxY;
            direction = reflectOverX(direction);
        }
    }

    PVector getPosition() { return position; }

    float getSenseRadius() { return senseRadius; }

    boolean isEaten() { return eaten; }
}

// Shared data
final int initialBugCount = 500;
ArrayList bugs = new ArrayList();
final int initialWidth = 800;
final int initialHeight = 800;
Bug selectedBug = null;

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

        if (x < 0) x = 0;
        else if (x >= indexCols) x = indexCols - 1;

        if (y < 0) y = 0;
        else if (y >= indexRows) y = indexRows - 1;

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

    ArrayList getNeighbors(Bug b, float r)
    {
        return getNeighbors2(b.getPosition(), r);
    }

    //
    // Get an ArrayList of all bugs within radius r
    //
    ArrayList getNeighbors2(PVector p, float r)
    {
        ArrayList ret = new ArrayList();
        PVector pq = quantize(p);
        float rq = r / resolution;

        // add all candidates
        for (int i = (int)(pq.x - rq); i < pq.x + rq; ++i)
        {
            if (i < 0 || i >= indexCols)
                continue;

            for (int j = (int)(pq.y - rq); j < pq.y + rq; ++j)
            {
                if (j < 0 || j >= indexRows)
                    continue;

                ret.addAll(index[i][j]);
            }
        }

        // remove out of bounds
        for (int i = ret.size(); i > 0; --i)
        {
            Bug b = (Bug)ret.get(i - 1);
            PVector tgt = b.getPosition();

            if (dist(p.x, p.y, tgt.x, tgt.y) > r)
                ret.remove(i - 1);
        }

        return ret;
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

    addNewBugs(initialBugCount);

    PFont fontA = loadFont("courier");
    textFont(fontA, 14);
}

// needed to keep the program pumping messages
void draw()
{
    stroke(0);
    fill(0, 16);
    rect(0, 0, width, height);

    // TODO: compact eaten bugs

    // update bugs
    for (int i = 0; i < bugs.size(); )
    {
        Bug b = (Bug)bugs.get(i);

        if (b.isEaten())
        {
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

    stroke(255);
    fill(255);

    text(bugs.size(), 14, 765);
    text(Bug.spawnTotal, 14, 780);
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
}

