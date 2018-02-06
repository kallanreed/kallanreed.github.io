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
    this.screen1 = document.getElementById("screen1");
    this.screen2 = document.getElementById("screen2");
    this.screen3 = document.getElementById("screen3");
    this.screen4 = document.getElementById("screen4");
    this.screens = [this.screen1, this.screen2, this.screen3, this.screen4];

    // screen 1 controls
    this.characterButtons =
    [
        document.getElementById("char1"),
        document.getElementById("char2"),
        document.getElementById("char3"),
        document.getElementById("char4"),
    ];

    // screen 2 controls
    this.characterName = document.getElementById("character-name");
    this.characterPortrait = document.getElementById("portrait");
    this.redCount = document.getElementById("red-count");
    this.greenCount = document.getElementById("green-count");
    this.blueCount = document.getElementById("blue-count");
    this.whiteCount = document.getElementById("white-count");
    this.cardCount = document.getElementById("card-count");
    this.cardHistory = document.getElementById("card-history");
    this.playTurnButton = document.getElementById("play-turn-button");
    this.endRoundButton = document.getElementById("end-round-button");
    this.mainButtons = [this.playTurnButton, this.endRoundButton];

    // screen 3 controls
    this.crystalButtons =
    [
        document.getElementById("new-mana-red"),
        document.getElementById("new-mana-green"),
        document.getElementById("new-mana-blue"),
        document.getElementById("new-mana-white"),
    ]

    // screen 4 controls
    this.cardButtons =
    [
        document.getElementById("new-card-red"),
        document.getElementById("new-card-green"),
        document.getElementById("new-card-blue"),
        document.getElementById("new-card-white"),
    ]
    
    this.state = null;
    var that = this;

    // TODO: generate selection UI
    this.characters =
    [
        {
            name: "Norowas",
            deck: [0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3],
            crystals: [2,0,0,1],
            portrait: "content/norowas.png"
        },
        {
            name: "Tovak",
            deck: [0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3],
            crystals: [2,0,0,1],
            portrait: "content/tovak.png"
        },
        {
            name: "Goldyx",
            deck: [0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3],
            crystals: [2,0,0,1],
            portrait: "content/goldyx.png"
        },
        {
            name: "Arythea",
            deck: [0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3],
            crystals: [2,0,0,1],
            portrait: "content/arythea.png"
        },
    ];

    // sets up the main screen for the first time
    this.initialize = function(charIndex)
    {
        var c = that.characters[charIndex];
        console.log("selected " + c.name);

        this.state = new DummyState(c.deck, c.crystals);
        this.updateRoundUI();
                
        this.characterName.innerText = c.name;
        this.characterPortrait.style.backgroundImage = "url('" + c.portrait + "')";
    }

    // shuffle deck, update crystal counts, and other per-round UI
    this.updateRoundUI = function()
    {
        this.state.prepareDeck();
        this.clearCardHistory();

        this.redCount.innerText = this.state.getCrystalCount(CrystalColor.Red);
        this.greenCount.innerText = this.state.getCrystalCount(CrystalColor.Green);
        this.blueCount.innerText = this.state.getCrystalCount(CrystalColor.Blue);
        this.whiteCount.innerText = this.state.getCrystalCount(CrystalColor.White);

        this.showItemInItems(this.playTurnButton, this.mainButtons);
        this.updateTurnUI();
    }

    // update card counts and other per-turn UI
    this.updateTurnUI = function()
    {
        this.cardCount.innerText = this.state.getRemainingCardCount();
    }

    // shows the item from the items array and hides the rest
    this.showItemInItems = function(item, items)
    {
        for (var i of items)
            if (i === item)
                i.setAttribute("class", "");
            else
                i.setAttribute("class", "hidden");
    }

    // put the UI in the "end of round state"
    this.setEndOfRound = function()
    {
        this.cardCount.innerText = "End of Round";
        this.showItemInItems(this.endRoundButton, this.mainButtons);
    }

    // TODO: move out
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

    this.clearCardHistory = function()
    {
        this.cardHistory.innerHTML = "";
    }

    this.addTurnContainer = function()
    {
        var elm = document.createElement("div");
        this.cardHistory.appendChild(elm);
        return elm;
    }

    this.addCardHistory = function(color, container)
    {
        var color = this.getColorString(color).toLowerCase();
        var elm = document.createElement("div");
        elm.setAttribute("class", color + "-card");
        container.appendChild(elm);
    }

    this.playTurnButton.onclick = function()
    {
        if (that.state.getRemainingCardCount() > 0)
        {
            var turnContainer = that.addTurnContainer();
            var drawn = that.state.playTurn();
            for (var c of drawn)
                that.addCardHistory(c, turnContainer);

            that.updateTurnUI();
        }
        else
        {
            that.setEndOfRound();
        }
    }

    this.endRoundButton.onclick = function()
    {
        that.showItemInItems(that.screen3, that.screens);
    }

    // TODO: de-dupe code
    // character selection handler and binding
    this.handleCharacterSelect = function()
    {
        that.initialize(this.index);
        that.showItemInItems(that.screen2, that.screens);
    }

    for (var i = 0; i < this.characterButtons.length; i++)
    {
        var button = this.characterButtons[i];
        button.onclick = this.handleCharacterSelect;
        button.index = i;
    }

    // crystal selection handler and binding
    this.handleCrystalSelect = function()
    {
        console.log("adding crystal " + that.getColorString(this.colorTag));
        that.state.addCrystal(this.colorTag);
        that.showItemInItems(that.screen4, that.screens);        
    }

    for (var i = 0; i < this.crystalButtons.length; i++)
    {
        var button = this.crystalButtons[i];
        button.onclick = this.handleCrystalSelect;
        button.colorTag = i;
    }

    // card selection handler and binding
    this.handleCardSelect = function()
    {
        console.log("adding card " + that.getColorString(this.colorTag));
        that.state.addCard(this.colorTag);
        that.showItemInItems(that.screen2, that.screens);
        that.updateRoundUI();
    }

    for (var i = 0; i < this.cardButtons.length; i++)
    {
        var button = this.cardButtons[i];
        button.onclick = this.handleCardSelect;
        button.colorTag = i;
    }

    this.showItemInItems(this.screen1, this.screens);
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