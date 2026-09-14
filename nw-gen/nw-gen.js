var app = new Vue({
    el: '#app',
    data: {
        lines: [],
        lyrics: [],
        inputWord: "the",
        suggestions: [],
        temperature: 1,
        meterPattern: "5,7,5"
    },
    methods: {
        addFromInput() {
            this.lyrics.push(this.inputWord);
            this.updateSuggestionsFromLyrics();
        },
        addFromSuggestion(s) {
            this.lyrics.push(s);
            this.updateSuggestionsFromLyrics();
        },
        commitLine() {
            this.lines.push(this.lyrics.join(" "));
            this.lyrics = [];
        },
        clear() {
            this.lines = [];
            this.lyrics = [];
            this.updateSuggestions(this.inputWord);
        },
        lastWord() {
            if (this.lyrics.length) {
                return this.lyrics[this.lyrics.length - 1];
            }

            return undefined;
        },
        contextWord() {
            if (this.lyrics.length) {
                return this.lastWord();
            }

            if (this.lines.length) {
                var lastLine = this.lines[this.lines.length - 1].split(" ");
                return lastLine[lastLine.length - 1];
            }

            return undefined;
        },
        // Backspace: removes exactly one word from the very end of the
        // lyrics, diving into the last committed line (making it editable
        // again) once the in-progress line runs out.
        undo() {
            if (this.lyrics.length) {
                this.lyrics.pop();
                this.updateSuggestionsFromLyrics();
                return;
            }

            if (this.lines.length) {
                var words = this.lines.pop().split(" ");
                words.pop();
                this.lyrics = words;
                this.updateSuggestionsFromLyrics();
            }
        },
        updateSuggestionsFromLyrics() {
            this.updateSuggestions(this.lastWord());
        },
        updateSuggestions(from) {
            if (from === undefined) {
                this.suggestions = [];
                return;
            }

            var toWordFreq = nwModel[from];
            if (toWordFreq === undefined) {
                this.suggestions = [];
                return;
            }

            var toWords = Array.from(Object.keys(toWordFreq))
            this.suggestions = toWords.sort((a, b) => {
                var aFreq = toWordFreq[a];
                var bFreq = toWordFreq[b];
                var deltaFreq = aFreq - bFreq;

                if (deltaFreq != 0) {
                    return -deltaFreq; // Invert so highest rank is first
                }

                if (a < b) { return -1 }
                if (b < a) { return 1 }
                return 0;
            });
        },
        parseMeter() {
            return this.meterPattern
                .split(",")
                .map((n) => parseInt(n.trim(), 10))
                .filter((n) => Number.isInteger(n) && n > 0);
        },
        usedSyllables() {
            return this.lyrics.reduce((sum, w) => sum + LyricGen.countSyllables(w), 0);
        },
        generateAutoLine() {
            var targets = this.parseMeter();
            var target = targets.length ? targets[0] : 7;
            var start = this.contextWord();

            if (this.lyrics.length) {
                // Finish the line already in progress instead of starting a new one.
                var remaining = Math.max(target - this.usedSyllables(), 1);
                var words = LyricGen.generateLine(nwModel, remaining, this.temperature, { start: start });
                this.lyrics = this.lyrics.concat(words);
                this.updateSuggestionsFromLyrics();
            } else {
                var words = LyricGen.generateLine(nwModel, target, this.temperature, { start: start });
                this.lines.push(words.join(" "));
                this.updateSuggestions(words[words.length - 1]);
            }
        },
        generateAutoPoem() {
            var targets = this.parseMeter();
            if (!targets.length) return;

            var current = this.contextWord();
            var newLines = [];
            var finishedLyrics = null;
            var i = 0;

            if (this.lyrics.length) {
                // Finish the line already in progress as the poem's first line.
                var remaining = Math.max(targets[0] - this.usedSyllables(), 1);
                var words = LyricGen.generateLine(nwModel, remaining, this.temperature, { start: current });
                finishedLyrics = this.lyrics.concat(words);
                if (words.length) current = words[words.length - 1];
                i = 1;
            }

            for (; i < targets.length; i++) {
                var lineWords = LyricGen.generateLine(nwModel, targets[i], this.temperature, { start: current });
                newLines.push(lineWords);
                if (lineWords.length) current = lineWords[lineWords.length - 1];
            }

            if (finishedLyrics) {
                this.lines.push(finishedLyrics.join(" "));
                this.lyrics = [];
            }
            newLines.forEach((words) => this.lines.push(words.join(" ")));
            this.updateSuggestions(current);
        }
    },
    created() {
        this.updateSuggestions(this.inputWord);
    }
  })

  