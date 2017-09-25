// gluten.js
// (c) 2017 - Kyle Reed

// hydration.js
// (c) 2017 - Kyle Reed

function HydrationData()
{
    this.reset = function() {
        this.flour = 0.0;
        this.flourProtein = 0.0;
        this.vital = 0.0;
        this.vitalProtein = 0.0;
        this.totalProtein = 0.0;
    }

    // initializes values
    this.reset();

    this.findVital = function() {
        // x(flour) + y(vital) = total(flour + vital)
        // x(flour) + y(vital) = total(flour) + total(vital)
        // y(vital) - total(vital) = total(flour) - x(flour)
        // vital(y - total) = flour(total - x)
        // vital = flour(total - x) / (y - total)

        if (this.vitalProtein - this.totalProtein == 0) return NaN;

        return (this.flour * (this.totalProtein - this.flourProtein)) / (this.vitalProtein - this.totalProtein);
    }

    this.isValid = function() {
        var validAndPositive = function(n) {
            return !isNaN(n) && n >= 0;
        };

        return validAndPositive(this.flour) &&
            validAndPositive(this.flourProtein) &&
            validAndPositive(this.vital) &&
            validAndPositive(this.vitalProtein) &&
            validAndPositive(this.totalProtein);
    }
}

function GlutenCalculation(name, lockedFields, calculation)
{
    this.name = name;
    this.lockedFields = lockedFields;
    this.calculation = calculation;
}

function GlutenContext()
{
    this.flourText = document.getElementById("flourText");
    this.flourProteinText = document.getElementById("flourProteinText");
    this.vitalText = document.getElementById("vitalText");
    this.vitalProteinText = document.getElementById("vitalProteinText");
    this.totalProteinText = document.getElementById("totalProteinText");
    this.clearButton = document.getElementById("clearButton");
    this.solveButton = document.getElementById("solveButton");

    var that = this;
    this.data = new HydrationData();
    this.currentCalculation = null;
    this.fields = [
        this.flourText,
        this.flourProteinText,
        this.vitalText,
        this.vitalProteinText,
        this.totalProteinText
    ];

    var parseOrDefault = function(s)
    {
        return s ? parseFloat(s) : 0;
    }

    this.calculations = [
        new GlutenCalculation(
            "Vital Gluten Weight",
            [this.vitalText],
            function(data) {
                data.vital = data.findVital();
            }
        )
    ];

    this.readValues = function()
    {
        this.data.flour = parseOrDefault(this.flourText.value);
        this.data.flourProtein = parseOrDefault(this.flourProteinText.value) / 100;
        this.data.vital = parseOrDefault(this.vitalText.value);
        this.data.vitalProtein = parseOrDefault(this.vitalProteinText.value) / 100;
        this.data.totalProtein = parseOrDefault(this.totalProteinText.value) / 100;
    }

    this.writeValues = function()
    {
        this.flourText.value = this.data.flour.toFixed(2);
        this.flourProteinText.value = (this.data.flourProtein * 100).toFixed(2);
        this.vitalText.value = this.data.vital.toFixed(2);
        this.vitalProteinText.value = (this.data.vitalProtein * 100).toFixed(2);
        this.totalProteinText.value = (this.data.totalProtein * 100).toFixed(2);
    }

    this.enableFields = function()
    {
        for (var f of this.fields) {
            f.readOnly = this.currentCalculation.lockedFields.includes(f);
        }
    }

    this.clearButton.onclick = function()
    {
        that.data.reset();
        that.writeValues();
    }

    this.solveButton.onclick = function()
    {
        that.readValues();
        that.currentCalculation.calculation(that.data);
        that.writeValues();

        if (!that.data.isValid()) {
            alert("Some values could not be found.\n" +
                "This usually means you would need to remove protein to meet target.");
        }
    }

    this.currentCalculation = this.calculations[0];
    this.enableFields();
}