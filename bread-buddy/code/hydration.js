// hydration.js
// (c) 2017 - Kyle Reed

function HydrationData()
{
    this.flour = 0.0;
    this.water = 0.0;
    this.starter = 0.0;
    this.starterHydration = 100.0;
    this.hydration = 0.0;
    this.total = 0.0;

    this.findFlour = function() {
        // hydration = totalWater / (flour + starterFlour)
        // flour = (totalWater - (hydration * starterFlour)) / hydration
        
        if (this.hydration === 0) return NaN;
        
        return (this.totalWater() - (this.hydration * this.starterFlour())) / this.hydration;
    }

    this.findWater = function() {
        // hydration = (water + starterWater) / totalFlour
        // water = (hydration * totalFlour) - starterWater
        
        return (this.hydration * this.totalFlour()) - this.starterWater();
    }

    this.findFlourAndWater = function() {
        // TODO: there's probably a nice matrix solution for this mess
        // totalWeight = (flour + starterFlour) + (water + starterWater)
        // totalWeight = (flour + starterFlour) + hydration * (flour + starterFlour)
        // totalWeight = (flour + starterFlour) * (1 + hydration)
        // flour + starterFlour = totalWeight / (1 + hydration)
        // flout = totalWeight / (1 + hydration) - starterFlour
        
        if (this.hydration === -1) return [NaN, NaN];
        
        let flour = this.total / (1 + this.hydration) - this.starterFlour();
        let water = this.total - flour - this.starter;
        
        return [flour, water];
    }

    this.findStarter = function() {
        // TODO: there's probably a nice matrix solution for this mess
        // hydration = (water + starterWater) / (flour + starterFlour)
        // starterWater = starterFlour * starterHydration
        // hydration = (water + (starterHydration * starterFlour)) / (flour + starterFlour)
        // hydration * (flour + starterFlour) = water + (starterHydration * starterFlour)
        // (hydration * starterFlour) = water + (starterHydration * starterFlour) - (hydration * flour)
        // (hydration * starterFlour) - (starterHydration * starterFlour) = water - (hydration * flour)
        // starterFlour * (hydration - starterHydration) = water - (hydration * flour)
        // starterFlour = (water - (hydration * flour)) / (hydration - starterHydration)
        
        // starterFlour is the amount of flour needed to make up
        // for the difference in hydrations

        if (this.hydration == this.starterHydration) return NaN;        
        
        let starterFlour = (this.water - (this.hydration * this.flour)) / (this.hydration - this.starterHydration);
        let starterWater = starterFlour * this.starterHydration;
        
        return starterFlour + starterWater
    }

    this.findHydration = function() {
        var totalFlour = this.totalFlour();

        if (totalFlour === 0) return NaN;

        return this.totalWater() / totalFlour;
    }

    this.findTotalWeight = function() {
        return this.totalFlour() + this.totalWater();
    }

    this.totalFlour = function() {
        return this.flour + this.starterFlour();
    }

    this.totalWater = function() {
        return this.water + this.starterWater();
    }

    this.starterFlour = function() {
        // starterFlour + starterHydration * starterFlour = starter
        // starterFlour(1 + starterHydration) = starter
        // starterFlour = starter / (1 + starterHydration)
        
        if (this.hydration === -1) return NaN;
        
        return this.starter / (1 + this.starterHydration);
    }

    this.starterWater = function() {
        return this.starter - this.starterFlour();
    }

    this.isValid = function() {
        var validAndPositive = function(n) {
            return !isNaN(n) && n >= 0;
        };

        return validAndPositive(this.flour) &&
            validAndPositive(this.water) &&
            validAndPositive(this.starter) &&
            validAndPositive(this.starterHydration) &&
            validAndPositive(this.hydration) &&
            validAndPositive(this.total);
    }
}

function HydrationCalculation(name, lockedFields, calculation)
{
    this.name = name;
    this.lockedFields = lockedFields;
    this.calculation = calculation;
}

function HydrationContext()
{
    this.flourText = document.getElementById("flourText");
    this.waterText = document.getElementById("waterText");
    this.starterText = document.getElementById("starterText");
    this.starterHydrationText = document.getElementById("starterHydrationText");
    this.hydrationText = document.getElementById("hydrationText");
    this.weightText = document.getElementById("weightText");
    this.calculationSelect = document.getElementById("calculationSelect");
    this.solveButton = document.getElementById("solveButton");

    var that = this;
    this.data = new HydrationData();
    this.currentCalculation = null;
    this.fields = [
        this.flourText,
        this.waterText,
        this.starterText,
        this.starterHydrationText,
        this.hydrationText,
        this.weightText
    ];

    var parseOrDefault = function(s)
    {
        return s ? parseFloat(s) : 0;
    }

    this.calculations = [
        new HydrationCalculation(
            "Flour & Water Weight",
            [this.flourText, this.waterText],
            function(data) {
                var pair = data.findFlourAndWater();
                data.flour = pair[0];
                data.water = pair[1];
            }
        ),

        new HydrationCalculation(
            "Flour Weight",
            [this.flourText, this.weightText],
            function(data) {
                if (data.hydration === 0) {
                    alert("Hydration must be greater than zero.");
                    return;
                }

                data.flour = data.findFlour();
                data.total = data.findTotalWeight();
            }
        ),

        new HydrationCalculation(
            "Water Weight",
            [this.waterText, this.weightText],
            function(data) {
                data.water = data.findWater();
                data.total = data.findTotalWeight();
            }
        ),

        new HydrationCalculation(
            "Starter Weight",
            [this.starterText, this.weightText],
            function(data) {
                if (data.starterHydration === data.hydration) {
                    alert("Cannot solve when starter hydration is equal to hydration.");
                    return;
                }

                data.starter = data.findStarter();
                data.total = data.findTotalWeight();
            }
        ),

        new HydrationCalculation(
            "Hydration",
            [this.hydrationText, this.weightText],
            function(data) {
                data.hydration = data.findHydration();
                data.total = data.findTotalWeight();
            }
        ),
    ]

    this.readValues = function()
    {
        this.data.flour = parseOrDefault(this.flourText.value);
        this.data.water = parseOrDefault(this.waterText.value);
        this.data.starter = parseOrDefault(this.starterText.value);
        this.data.starterHydration = parseOrDefault(this.starterHydrationText.value) / 100;
        this.data.hydration = parseOrDefault(this.hydrationText.value) / 100;
        this.data.total = parseOrDefault(this.weightText.value);
    }

    this.writeValues = function()
    {
        this.flourText.value = this.data.flour.toFixed(2);
        this.waterText.value = this.data.water.toFixed(2);
        this.starterText.value = this.data.starter.toFixed(2);
        this.starterHydrationText.value = (this.data.starterHydration * 100);
        this.hydrationText.value = (this.data.hydration * 100).toFixed(2);
        this.weightText.value = this.data.total.toFixed(2);
    }

    this.enableFields = function()
    {
        for (var f of this.fields) {
            f.readOnly = this.currentCalculation.lockedFields.includes(f);
        }
    }

    this.solveButton.onclick = function()
    {
        that.readValues();
        that.currentCalculation.calculation(that.data);
        that.writeValues();

        if (!that.data.isValid()) {
            alert("Some values could not be found.\n" +
                "This usually means you would need to remove water to meet expected hydration.");
        }
    }

    this.calculationSelect.onchange = function()
    {
        var index = this.value;

        if (index < 0) return;

        that.currentCalculation = that.calculations[index];
        that.enableFields();
    }

    // set up the select control
    var options = "";

    for (var i = 0; i < this.calculations.length; i++) {
        var c = this.calculations[i];
        options += "<option value=\"" + i + "\">" + c.name + "</option>\n";
    }

    this.calculationSelect.innerHTML = options;
    this.calculationSelect.value = 0;
    this.calculationSelect.onchange();
}