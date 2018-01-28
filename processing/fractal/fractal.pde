
    PVector screenDim = new PVector(400, 400);
    PVector coordCenter = new PVector(-0.5, 0);
    float coordRange = 1.5;
    int iterationCutoff = 32;

    PVector toScreen(float x, float y)
    {
        float minX = coordCenter.x - coordRange;
        float maxX = coordCenter.x + coordRange;
        float minY = coordCenter.y - coordRange;
        float maxY = coordCenter.y + coordRange;

        return new PVector(

            map(x, minX, maxX, 0, screenDim.x),
            map(y, maxY, minY, 0, screenDim.y)
        );
    }

    PVector toCoordinate(float x, float y)
    {
        float minX = coordCenter.x - coordRange;
        float maxX = coordCenter.x + coordRange;
        float minY = coordCenter.y - coordRange;
        float maxY = coordCenter.y + coordRange;

        return new PVector(
            map(x, 0, screenDim.x, minX, maxX),
            map(y, 0, screenDim.y, maxY, minY)
        );
    }

    class Complex
    {
        float a;
        float b;

        Complex(float a, float b)
        {
            this.a = a;
            this.b = b;
        }

        Complex add(Complex other)
        {
            a += other.a;
            b += other.b;
            return this;
        }

        Complex mult(Complex other)
        {
            // (a+bi) * (c+di) = (ac - bd) + (bc + ad)i
            float temp_a = a * other.a - b * other.b;
            float temp_b = b * other.a + a * other.b;
            a = temp_a;
            b = temp_b;
            return this;
        }

        void set(float a, float b)
        {
            this.a = a;
            this.b = b;
        }

        float distOrigin()
        {
            return sqrt(sq(a) + sq(b));
        }
    }

    // mutating globals because processing.js can't figure out
    // "stack" local class types.
    Complex zIter = new Complex(0, 0);
    Complex curCoord = new Complex(0, 0);

    int getExitIteration(Complex c)
    {
        zIter.set(0, 0);
        for (int i = 0; i < iterationCutoff; ++i)
        {
            zIter.mult(zIter).add(c);
            if (zIter.distOrigin() >= 2)
                return i;
        }

        return -1;
    }

    void setup()
    {
        size(400, 400);

        stroke(0);
        fill(255);
        rect(0, 0, screenDim.x, screenDim.y);
    }

    color[] pal = new color[] {
        color(60, 0, 0),
        color(255, 0, 0),
        color(255, 255, 0),
        color(60, 255, 60),
        color(0, 255, 255),
        color(255, 0, 255),
        color(0, 0, 255)
    };

    color getColor(int i)
    {
        if (i < 0)
            return color(0);
            
        float position = map(i, 0, iterationCutoff, 0, pal.length - 1);
        int index = floor(position);
        
        color start = pal[index];
        color end = pal[index + 1];
        return lerpColor(start, end, (position - index));
    }

    // color getColor(int i)
    // {
    //     if (i < 0)
    //         return color(0);

    //     return color(map(i, 0, iterationCutoff, 32, 255));
    // }

    void setPixel(int x, int y, color c)
    {
        int offset = y * (int)screenDim.x + x;
        pixels[offset] = c;
    }

    void draw()
    {
        loadPixels();

        for (int x = 0; x < screenDim.x; ++x)
        {
            for (int y = 0; y < screenDim.y; ++y)
            {
                PVector coord = toCoordinate(x, y);
                curCoord.set(coord.x, coord.y);
                int exitIter = getExitIteration(curCoord);
                setPixel(x, y, getColor(exitIter));
            }
        }

        updatePixels();
        noLoop();
    }

    void reset()
    {
        coordCenter = new PVector(-0.5, 0);
        coordRange = 1.5;
        iterationCutoff = 20;
    }

    void keyPressed()
    {
        if (key == 'r')
            reset();

        // moving the center, opposite sign
        else if (key == 'w')
            coordCenter.y += coordRange / 3;
        else if (key == 's')
            coordCenter.y -= coordRange / 3;
        else if (key == 'a')
            coordCenter.x -= coordRange / 3;
        else if (key == 'd')
            coordCenter.x += coordRange / 3;

        else if (key == 'q')
            coordRange /= 0.5;
        else if (key == 'e')
            coordRange *= 0.5;

        else if (key == '=' || key == '+')
            iterationCutoff += 1;
        else if (key == '-')
            iterationCutoff -= 1;
        else
            return;

        loop();
    }

    void mouseClicked()
    {
        coordCenter = toCoordinate(mouseX, mouseY);

        if (mouseButton == LEFT)
            coordRange *= 0.5;
        else
            coordRange /= 0.5;
        
        loop();
    }