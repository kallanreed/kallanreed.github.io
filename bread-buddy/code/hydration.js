function HydrationData()
{
    this.flour = 0.0;
    this.water = 0.0;
    this.starter = 0.0;
    this.starterHydration = 100.0;
    this.hydration = 0.0;
    this.total = 0.0;
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
            "Hydration & Total Weight",
            [this.hydrationText, this.weightText],
            function(data) {
                data.hydration = (data.water / data.flour * 100).toFixed(2);
                data.total = data.flour + data.water;
            }
        )
    ]

    this.readValues = function()
    {
        this.data.flour = parseOrDefault(this.flourText.value);
        this.data.water = parseOrDefault(this.waterText.value);
        this.data.starter = parseOrDefault(this.starterText.value);
        this.data.starterHydration = parseOrDefault(this.starterHydrationText.value);
        this.data.hydration = parseOrDefault(this.hydrationText.value);
        this.data.total = parseOrDefault(this.weightText.value);
    }

    this.writeValues = function()
    {
        this.flourText.value = this.data.flour;
        this.waterText.value = this.data.water;
        this.starterText.value = this.data.starter;
        this.starterHydrationText.value = this.data.starterHydration;
        this.hydrationText.value = this.data.hydration;
        this.weightText.value = this.data.total;
    }

    this.enableFields = function()
    {
        console.log("Enabling required fields...");

        for (var f of this.fields) {
            f.disabled = this.currentCalculation.lockedFields.includes(f);
        }
    }

    this.solveButton.onclick = function()
    {
        that.readValues();
        that.currentCalculation.calculation(that.data);
        that.writeValues();
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