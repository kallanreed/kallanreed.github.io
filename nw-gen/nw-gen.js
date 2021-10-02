var app = new Vue({
    el: '#app',
    data: {
        lines: [],
        lyrics: [],
        inputWord: "the",
        suggestions: []
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
        undo() {
            this.lyrics.pop();
            this.updateSuggestionsFromLyrics();
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
        }
    },
    created() {
        this.updateSuggestions(this.inputWord);
    }
  })

  