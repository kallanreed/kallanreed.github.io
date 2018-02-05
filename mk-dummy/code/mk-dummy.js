// mk-dummy.js
// (c) 2018 - Kyle Reed

// color enum
var CrystalColor = Object.freeze({
    Red: 0, Green: 1, Blue: 2, White: 3
});

// get the last element of an array
function last_of(arr)
{
    if (arr.length)
        return arr[arr.length - 1];
    
    return undefined;
}

//
// cards:       array[n]
// crystals:    array[4]
//
function DummyState(cards, crystals)
{
    // set of all cards the player owns
    this.cards = cards;

    // all of the crystals the player owns
    this.crystals = crystals;

    // the current deck being played with (derived from cards)
    this.deck = [];

    this.addCrystal = function(color)
    {
        this.crystals[color]++;
    }

    this.getCrystalCount = function(color)
    {
        return this.crystals[color];
    }

    this.addCard = function(color)
    {
        this.cards.push(color);
    }

    this.getRemainingCardCount = function()
    {
        return this.deck.length;
    }

    this.prepareDeck = function()
    {
        console.log("preparing deck...");

        // make a copy of the deck
        this.deck = this.cards.slice();
        console.log("starting deck: " + this.deck);

        // randomize the deck
        for (var i = 0; i < this.deck.length; i++) {
            var j = Math.floor(Math.random() * this.deck.length);
            // swap cards at i, j
            var temp = this.deck[i];
            this.deck[i] = this.deck[j];
            this.deck[j] = temp;
        }

        console.log("randomized deck: " + this.deck);        
    }

    this.drawCards = function(count)
    {
        var drawn = [];

        while (count && this.deck.length)
        {
            var card = this.deck.pop();
            console.log("drew card: " + card);
            drawn.push(card);
            count--;
        }

        return drawn;
    }

    this.playTurn = function()
    {
        if (this.deck.length == 0)
            return; // declare end of round

        // draw three cards
        var drawn = this.drawCards(3);

        // if we have crystals the color of the last card
        // draw that many more cards
        var last = last_of(drawn);
        if (last !== undefined)
        {
            var crystalCount = this.crystals[last];
            console.log("drawing " + crystalCount + " more for crystals...");            
            drawn.push(...this.drawCards(crystalCount));
        }

        console.log("turn cards: " + drawn);
        return drawn;
    }

    this.isEndOfRound = function()
    {
        return this.deck.length === 0;
    }

    this.toString = function()
    {
        return "Crystals " + 
            this.crystals[CrystalColor.Red] + ", " +
            this.crystals[CrystalColor.Blue] + ", " +
            this.crystals[CrystalColor.Green] + ", " +
            this.crystals[CrystalColor.White] + "\n" +
            "Cards: " + this.cards + "\n" +
            "Deck: " + this.deck;
    }
}

function UIContext()
{
    this.redCount = document.getElementById("red-count");
    this.greenCount = document.getElementById("green-count");
    this.blueCount = document.getElementById("blue-count");
    this.whiteCount = document.getElementById("white-count");
    this.cardCount = document.getElementById("card-count");
    this.cardHistory = document.getElementById("card-history");
    this.playTurnButton = document.getElementById("play-turn-button");
    
    this.state = new DummyState([1,2,3,0,0,1,2,0,1,3,0,3,2,1,2,3], [1,0,2,0]);
    var that = this;

    this.refreshUI = function()
    {
        this.redCount.innerText = this.state.getCrystalCount(CrystalColor.Red);
        this.greenCount.innerText = this.state.getCrystalCount(CrystalColor.Green);
        this.blueCount.innerText = this.state.getCrystalCount(CrystalColor.Blue);
        this.whiteCount.innerText = this.state.getCrystalCount(CrystalColor.White);
        this.cardCount.innerText = this.state.getRemainingCardCount();
    }

    this.getColorString = function(color)
    {
        switch (color)
        {
            case CrystalColor.Red: return "Red";
            case CrystalColor.Green: return "Green";
            case CrystalColor.Blue: return "Blue";
            case CrystalColor.White: return "White";
            default: return "unknown";
        }
    }

    this.addCardHistory = function(color)
    {
        var color = this.getColorString(color).toLowerCase();
        var elm = document.createElement("div");
        elm.setAttribute("class", color + "-card");

        this.cardHistory.appendChild(elm);
    }

    this.clearCardHistory = function()
    {
        this.cardHistory.innerHTML = "";
    }

    this.playTurnButton.onclick = function()
    {
        if (that.state.getRemainingCardCount() > 0)
        {
            var drawn = that.state.playTurn();
            for (var c of drawn)
                that.addCardHistory(c);

            that.refreshUI();
        }
        else
        {
            that.cardCount.innerText = "End of Round";
        }
    }

    this.state.prepareDeck();
    this.clearCardHistory();
    this.refreshUI();
}

function runTest()
{
    var ds = new DummyState([1,2,3,0,0,1,2,0,1,3,0,3,2,1,0,1], [1,2,0,0]);
    ds.prepareDeck();

    var turns = 1;
    for (; !ds.isEndOfRound(); turns++)
        ds.playTurn();

    console.log("end of round in " + turns + " turns");

    console.log(ds.toString());
}