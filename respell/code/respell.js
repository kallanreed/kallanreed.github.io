// respell.js
// (c) 2018 - Kyle Reed
// be sure to set utf-8 charset when including
// use https://tophonetics.com for testing
// use http://www.phonemicchart.com/transcribe/ for testing

class Node
{
    constructor(v)
    {
        this.value = v;
        this.childen = [];
        this._data;
    }

    getChild(v)
    {
        for (let c of this.childen)
            if (c.value === v)
                return c;

        return null;
    }

    addChild(v)
    {
        let c = new Node(v);
        this.childen.push(c);
        return c;
    }

    getOrAddChild(v)
    {
        let c = this.getChild(v);

        if (c !== null)
            return c;

        return this.addChild(v);
    }

    contains(v)
    {
        return this.getChild(v) != null;
    }

    get data()
    {
        return this._data;
    }

    set data(d)
    {
        if (this._data !== undefined)
            throw "Ambiguous entry";

        this._data = d;
    }
}

class Trie
{
    constructor()
    {
        this.root = new Node();
    }

    add(str, data)
    {
        let n = this.root;

        for (let c of str)
            n = n.getOrAddChild(c);

        n.data = data;
    }

    findLongest(str)
    {
        let n = this.root;
        let d = { data: null, pathLength: 0 };

        for (let i = 0; i < str.length; ++i)
        {
            n = n.getChild(str[i]);

            if (n === null)  // unknown path
                return d;

            if (n.data != null) // found a new longest
                d = { data: n.data, pathLength: i + 1 };
        }

        return d;
    }
}

class ReSpeller
{
    constructor()
    {
        let t = new Trie();
        
        // construct IPA to pronunciation
        // consonants
        t.add("tʃ",  {s: "ch",  isVowel: false });
        t.add("h",   {s: "h",   isVowel: false });
        t.add("hw",  {s: "wh",  isVowel: false });
        t.add("ʤ",   {s: "j",   isVowel: false });
        t.add("dʒ",  {s: "j",   isVowel: false });
        t.add("x",   {s: "kh",  isVowel: false });
        t.add("g",   {s: "gh",  isVowel: false });
        t.add("ɡ",   {s: "gh",  isVowel: false }); // not a regular 'g'
        t.add("ŋ",   {s: "ng",  isVowel: false });
        t.add("ʃ",   {s: "sh",  isVowel: false });
        t.add("θ",   {s: "th",  isVowel: false });
        t.add("ð",   {s: "dh",  isVowel: false });
        t.add("j",   {s: "y",   isVowel: false });
        t.add("ʒ",   {s: "zh",  isVowel: false });

        // consonants (normal characters)
        t.add("b",   {s: "b",   isVowel: false });
        t.add("d",   {s: "d",   isVowel: false });
        t.add("f",   {s: "f",   isVowel: false });
        t.add("k",   {s: "k",   isVowel: false });
        t.add("l",   {s: "l",   isVowel: false });
        t.add("m",   {s: "m",   isVowel: false });
        t.add("n",   {s: "n",   isVowel: false });
        t.add("p",   {s: "p",   isVowel: false });
        t.add("r",   {s: "r",   isVowel: false });
        t.add("s",   {s: "s",   isVowel: false });
        t.add("t",   {s: "t",   isVowel: false });
        t.add("v",   {s: "v",   isVowel: false });
        t.add("w",   {s: "w",   isVowel: false });
        t.add("z",   {s: "z",   isVowel: false });

        // vowels
        t.add("æ",   {s: "ă",   isVowel: true });
        t.add("eɪ",  {s: "ay",  isVowel: true });
        t.add("ɛər", {s: "air", isVowel: true });
        t.add("ɑ",   {s: "ah",  isVowel: true });
        t.add("ɑː",  {s: "ah",  isVowel: true });
        t.add("ɑr",  {s: "ar",  isVowel: true });
        t.add("ɑːr", {s: "ar",  isVowel: true });
        t.add("ɛ",   {s: "eh",  isVowel: true });
        t.add("i",   {s: "ee",  isVowel: true });
        t.add("iː",  {s: "ee",  isVowel: true });
        t.add("ɪər", {s: "eer", isVowel: true });
        t.add("ɪ",   {s: "ih",  isVowel: true });
        t.add("aɪ",  {s: "y",   isVowel: true });
        t.add("ɒ",   {s: "ah",  isVowel: true });
        t.add("oʊ",  {s: "oh",  isVowel: true });
        t.add("ɔ",   {s: "aw",  isVowel: true });
        t.add("ɔː",  {s: "aw",  isVowel: true });
        t.add("ɔr",  {s: "ohr", isVowel: true });
        t.add("ɔːr", {s: "ohr", isVowel: true });
        t.add("ɔɪ",  {s: "oy",  isVowel: true });
        t.add("ʊ",   {s: "uu",  isVowel: true });
        t.add("ʊər", {s: "oor", isVowel: true });
        t.add("u",   {s: "oo",  isVowel: true });
        t.add("uː",  {s: "oo",  isVowel: true });
        t.add("aʊ",  {s: "ow",  isVowel: true });
        t.add("ʌ",   {s: "uh",  isVowel: true });
        t.add("ɜ",   {s: "er",  isVowel: true });
        t.add("ɜr",  {s: "ur",  isVowel: true });
        t.add("ɜːr", {s: "ur",  isVowel: true });
        t.add("ə",   {s: "ah",  isVowel: true });
        t.add("ər",  {s: "er",  isVowel: true });
        t.add("ju",  {s: "yew", isVowel: true });
        t.add("juː", {s: "yew", isVowel: true });

        this.mapping = t;
    }

    parse(str)
    {
        let out = "";
        let i = 0;
        let stressed = false;
        let hasStressedVowel = false;
        let hasStressedConsonant = false;

        // TODO: rewrite without slice
        // The syllable stress detection isn't perfect

        while (str.length > 0)
        {
            // CAREFUL: these are not normal quotes
            if (str[0] === 'ˈ' || str[0] == 'ˌ')
            {
                stressed = true;
                hasStressedVowel = false;
                hasStressedConsonant = false;
                str = str.slice(1);
                continue;
            }

            let mapped = this.mapping.findLongest(str);

            if (mapped.data === null)
            {
                // TODO: just skip?
                out += str[0];
                str = str.slice(1);
            }
            else
            {
                str = str.slice(mapped.pathLength);

                // if we see a new consonant after a stressed vowel
                // and stressed consonant, assume a new syllable
                if (!mapped.data.isVowel && hasStressedVowel && hasStressedConsonant)
                {
                    stressed = false;
                    hasStressedVowel = false;
                    hasStressedConsonant = false;
                }

                // show stressed syllable in uppercase
                if (stressed)
                    out += mapped.data.s.toUpperCase();
                else
                    out += mapped.data.s;

                // rough syllable tracking
                if (mapped.data.isVowel && stressed)
                    hasStressedVowel = true;
                else if (!mapped.data.isVowel && stressed)
                    hasStressedConsonant = true;
            }
        }

        return out;
    }
}

class ReSpellContext
{
    constructor()
    {
        this.respell = new ReSpeller();
        this.input = document.getElementById("input-text");
        this.output = document.getElementById("output");
        let that = this;

        this.input.onchange = function() {
            that.output.innerText = that.respell.parse(this.value);
        };

        this.input.onchange();
    }    
}