// Automatic lyric generation on top of the nwModel bigram table.
//
// Two problems this is trying to soften:
//   1. Strict markov generation is limited to words that were literally
//      observed following each other, so it drifts into loops/dead ends
//      and can never surface words the source lyrics happened not to pair.
//   2. There is no notion of meter, so lines rarely scan when sung.
//
// "Temperature" here does double duty across its 0-2 range:
//   - 0..1 reshapes how sharply the markov table's own frequencies are
//     followed (0 = always the most common next word, 1 = sample
//     proportional to observed frequency).
//   - 1..2 additionally starts substituting the sampled word for one that
//     the model never actually saw follow the current word (drawn from
//     the model's full vocabulary, or, at the high end, from a small
//     hand-picked word bank that isn't in the model's training data at
//     all) so lines aren't limited to attested transitions.

(function (global) {
    var FILLER_WORDS = ["the", "a", "and", "oh", "my", "so", "now", "then", "we", "you", "i"];

    // Deliberately not present in nwModel - lets high temperature reach
    // outside the source lyrics entirely instead of just outside the
    // current word's observed neighbors.
    var NOVEL_WORDS = [
        "moonrise", "abyss", "ember", "hollow", "wraith", "eternal", "frostlight",
        "mirror", "phantom", "solace", "requiem", "wanderlust", "twilight", "thorned",
        "silvern", "hymn", "oblivion", "starfall", "veil", "elegy", "windswept",
        "shadowed", "everdark", "nightbloom", "silence", "dreamless", "glacial",
        "aurora", "borealis", "cascade", "cinder", "crimson", "crystalline",
        "drift", "echoing", "faded", "fathomless", "flicker", "gossamer",
        "gravebound", "grieving", "harbor", "haven", "hearthfire", "horizonless",
        "hushed", "icebound", "immortal", "ivory", "labyrinthine", "lament",
        "lantern-lit", "lullaby", "luminous", "meridian", "mist", "moonlit",
        "mournful", "murmuring", "nightfall", "nightingale's", "nocturne", "opaline",
        "opal", "parchment", "penumbra", "phosphor", "pilgrim", "quicksilver",
        "raven", "reliquary", "resonance", "rime", "runic", "sable",
        "sanctum", "seraph", "shimmering", "skybound", "smolder", "somber",
        "spectral", "spire", "starlight", "stillness", "stormlight", "sunken",
        "tempest", "threadbare", "throne", "tidewater", "timeless", "torchlit",
        "tundra", "umbral", "undertow", "unraveling", "vagrant", "vespers",
        "vigil", "voidsong", "waning", "waylost", "weathered", "whispering",
        "wildfire", "willowed", "wintersong", "wisp", "wolfsong", "wraithlight",
        "yearning", "zephyr"
    ];

    function countSyllables(word) {
        word = (word || "").toLowerCase().replace(/[^a-z']/g, "");
        if (!word) return 0;
        if (word.length <= 3) return 1;
        word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
        word = word.replace(/^y/, "");
        var matches = word.match(/[aeiouy]{1,2}/g);
        return matches ? matches.length : 1;
    }

    function vocabulary(model) {
        return Object.keys(model).filter(function (w) { return w !== "$start$"; });
    }

    function randomFrom(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    // Raises each candidate's frequency to the power of 1/temperature so
    // low temperature sharpens toward the max-frequency word and high
    // temperature flattens toward uniform-random among candidates.
    function weightedSample(freqMap, temperature) {
        var words = Object.keys(freqMap);
        if (!words.length) return undefined;
        var t = Math.max(Math.min(temperature, 1), 0.05);
        var weights = words.map(function (w) { return Math.pow(freqMap[w], 1 / t); });
        var total = weights.reduce(function (a, b) { return a + b; }, 0);
        var r = Math.random() * total;
        for (var i = 0; i < words.length; i++) {
            r -= weights[i];
            if (r <= 0) return words[i];
        }
        return words[words.length - 1];
    }

    // Picks the next word given the current one, letting temperature above
    // 1 chance-substitute a word the markov chain never actually saw here.
    function sampleNextWord(model, current, temperature, vocab) {
        var freqMap = model[current];
        var onModelPick = (freqMap && Object.keys(freqMap).length)
            ? weightedSample(freqMap, temperature)
            : undefined;

        if (temperature <= 1) {
            return onModelPick;
        }

        var wildness = temperature - 1; // 0..1
        var roll = Math.random();
        if (roll < wildness * 0.15) {
            return randomFrom(NOVEL_WORDS);
        }
        if (roll < wildness * 0.6) {
            return randomFrom(vocab);
        }
        return onModelPick || randomFrom(vocab);
    }

    // Builds one line aiming for an exact syllable count. Tries a bounded
    // number of candidates per word so a bad pick doesn't blow the budget;
    // falls back to a short filler word to land on the target exactly, and
    // gives up on the exact target (returning its best attempt) rather than
    // looping forever if the model can't get there.
    function generateLine(model, targetSyllables, temperature, opts) {
        opts = opts || {};
        var vocab = opts.vocab || vocabulary(model);
        var maxAttempts = opts.maxAttempts || 40;
        var maxWordTries = opts.maxWordTries || 12;
        var maxWords = opts.maxWords || Math.max(targetSyllables * 2, 6);

        var start = opts.start || "$start$";
        var best = [];
        for (var attempt = 0; attempt < maxAttempts; attempt++) {
            var words = [];
            var syllables = 0;
            var current = start;

            while (syllables < targetSyllables && words.length < maxWords) {
                var remaining = targetSyllables - syllables;
                var picked;
                for (var tries = 0; tries < maxWordTries; tries++) {
                    var candidate = sampleNextWord(model, current, temperature, vocab);
                    if (!candidate) break;
                    var s = countSyllables(candidate);
                    if (s > 0 && s <= remaining) {
                        picked = candidate;
                        break;
                    }
                }
                if (!picked) {
                    // Land exactly on target with a short filler if nothing sampled fits.
                    var filler = FILLER_WORDS.find(function (w) { return countSyllables(w) === remaining; });
                    if (filler) {
                        words.push(filler);
                        syllables += remaining;
                    }
                    break;
                }
                words.push(picked);
                syllables += countSyllables(picked);
                current = picked;
            }

            if (syllables === targetSyllables) return words;
            if (words.length > best.length) best = words;
        }
        return best;
    }

    // pattern: array of per-line syllable targets, e.g. [5, 7, 5] for a haiku.
    // Each line continues from the last word of the previous one (or
    // opts.start for the first line) so the poem reads as one continuous
    // chain rather than unrelated lines.
    function generatePoem(model, pattern, temperature, opts) {
        opts = opts || {};
        var vocab = opts.vocab || vocabulary(model);
        var current = opts.start;
        var lines = [];
        pattern.forEach(function (target) {
            var words = generateLine(model, target, temperature, Object.assign({}, opts, { vocab: vocab, start: current }));
            lines.push(words);
            if (words.length) current = words[words.length - 1];
        });
        return lines;
    }

    global.LyricGen = {
        countSyllables: countSyllables,
        vocabulary: vocabulary,
        sampleNextWord: sampleNextWord,
        generateLine: generateLine,
        generatePoem: generatePoem,
        NOVEL_WORDS: NOVEL_WORDS
    };
})(window);
