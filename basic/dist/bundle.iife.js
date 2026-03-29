(function(){var e=RegExp(`\\b(${`PRINT.INPUT.IF.THEN.ELSE.GOTO.GOSUB.RETURN.FOR.TO.STEP.NEXT.WHILE.WEND.DIM.LET.REM.END.STOP.CLS.RUN.LIST.LOAD.SAVE.NEW.AND.OR.NOT.MOD.INT.ABS.SQR.RND.LEN.MID$.LEFT$.RIGHT$.STR$.VAL.CHR$.ASC.TAB.DATA.READ.RESTORE.ON.OPEN.CLOSE.PRINT#.INPUT#.RENUM`.split(`.`).join(`|`)})\\b`,`gi`);function t(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`)}function n(n){let r=n.match(/^(\s*\d*\s*)(REM\b.*)/i);if(r)return t(r[1])+`<span class="rem">${t(r[2])}</span>`;let i=n.match(/^(\s*)(\d+)(\s+)(.*)/),a=``,o=``;i?(a=`${t(i[1])}<span class="ln">${t(i[2])}</span>${t(i[3])}`,o=i[4]):o=n;let s=``,c=0;for(;c<o.length;)if(o[c]===`"`){let e=c+1;for(;e<o.length&&o[e]!==`"`;)e++;e++,s+=`<span class="str">${t(o.slice(c,e))}</span>`,c=e}else{let n=o.slice(c);e.lastIndex=0;let r=e.exec(n);if(r&&r.index===0)s+=`<span class="kw">${t(r[0])}</span>`,c+=r[0].length;else if(/\d/.test(o[c])){let e=n.match(/^\d+(\.\d+)?/);s+=`<span class="num">${t(e[0])}</span>`,c+=e[0].length}else s+=t(o[c]),c++}return a+s}var r=class{constructor(e){this.container=e,this._source=``,this._onChange=null,this._onKey=null,this._render()}_render(){this.container.innerHTML=`<div class="editor-wrap"><div id="editor" contenteditable="true" inputmode="none" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div></div>`,this.el=this.container.querySelector(`#editor`),this._bindEvents()}_bindEvents(){this.el.addEventListener(`keydown`,e=>{this._onKey&&this._onKey(e),!(e.metaKey||e.ctrlKey)&&e.preventDefault()}),this.el.addEventListener(`input`,()=>{this._syncFromDOM()})}setOnChange(e){this._onChange=e}setOnKey(e){this._onKey=e}getSource(){return this._source}setSource(e){this._source=e,this._renderHighlight()}insertText(e){this._insertAtCursor(e)}_insertAtCursor(e){let{line:t,col:n}=this._getCursorPos(),r=this._source.split(`
`);if(e===`
`){r[t];let e=this._nextLineNumber(r,t),n=e?`${e} `:``;r.splice(t+1,0,n),this._source=r.join(`
`),this._renderHighlight(),this._setCursorPos(t+1,n.length)}else if(e===`BACKSPACE`){if(n>0)r[t]=r[t].slice(0,n-1)+r[t].slice(n),this._source=r.join(`
`),this._renderHighlight(),this._setCursorPos(t,n-1);else if(t>0){let e=r[t-1].length;r[t-1]+=r[t],r.splice(t,1),this._source=r.join(`
`),this._renderHighlight(),this._setCursorPos(t-1,e)}}else e===`LEFT`?n>0?this._setCursorPos(t,n-1):t>0&&this._setCursorPos(t-1,(r[t-1]||``).length):e===`RIGHT`?n<(r[t]||``).length?this._setCursorPos(t,n+1):t<r.length-1&&this._setCursorPos(t+1,0):(r[t]=r[t].slice(0,n)+e+r[t].slice(n),this._source=r.join(`
`),this._renderHighlight(),this._setCursorPos(t,n+e.length));this._onChange&&this._onChange(this._source)}_nextLineNumber(e,t){let n=e[t]||``,r=parseInt(n.match(/^\s*(\d+)/)?.[1]||`0`,10);for(let n=t+1;n<e.length;n++){let t=e[n].match(/^\s*(\d+)/);if(t){let e=parseInt(t[1],10),n=r+Math.floor((e-r)/2);return n>r?n:r+10}}return r?r+10:10}_renderHighlight(){let e=this._source.split(`
`);this.el.innerHTML=e.map(e=>`<div>${n(e)||`<br>`}</div>`).join(``)}_syncFromDOM(){this._source=this.el.innerText,this._renderHighlight(),this._onChange&&this._onChange(this._source)}_getCursorPos(){let e=window.getSelection();if(!e||e.rangeCount===0)return{line:0,col:0};let t=e.getRangeAt(0),n=this.el.querySelectorAll(`div`),r=0;for(let e=0;e<n.length;e++)if(n[e].contains(t.startContainer)){r=e;break}let i=0,a=document.createTreeWalker(n[r]||this.el,NodeFilter.SHOW_TEXT),o;for(;o=a.nextNode();){if(o===t.startContainer){i+=t.startOffset;break}i+=o.textContent.length}return{line:r,col:i}}_setCursorPos(e,t){let n=this.el.querySelectorAll(`div`)[e];if(!n)return;n.scrollIntoView({block:`nearest`});let r=document.createRange(),i=window.getSelection(),a=t,o=document.createTreeWalker(n,NodeFilter.SHOW_TEXT),s,c=!1;for(;s=o.nextNode();){if(a<=s.textContent.length){r.setStart(s,a),r.collapse(!0),c=!0;break}a-=s.textContent.length}c||(r.selectNodeContents(n),r.collapse(!1)),i.removeAllRanges(),i.addRange(r),this.el.focus()}focus(){this.el.focus()}setReadOnly(e){this.el.contentEditable=e?`false`:`true`}},i=[`PRINT.INPUT.IF.THEN.ELSE.GOTO.GOSUB.RETURN.FOR.TO.NEXT.WHILE.WEND.DIM.LET.REM.END.STOP.CLS.AND.OR.NOT.MOD.STEP.DATA.READ.RESTORE.ON.RENUM`.split(`.`)],a=[[{label:`1`},{label:`2`},{label:`3`},{label:`+`},{label:`-`},{label:`=`},{label:`<`},{label:`>`},{label:`^`}],[{label:`4`},{label:`5`},{label:`6`},{label:`*`},{label:`/`},{label:`(`},{label:`)`},{label:`"`},{label:`$`}],[{label:`7`},{label:`8`},{label:`9`},{label:`0`},{label:`.`},{label:`,`},{label:`;`},{label:`:`},{label:`#`}],[{label:`⌫`,action:`BACKSPACE`,cls:`action`},{label:`◀`,action:`LEFT`,cls:`dim`},{label:`▶`,action:`RIGHT`,cls:`dim`},{label:`SPACE`,action:` `,cls:`wide`},{label:`↵`,action:`
`,cls:`action wide`}]],o=class{constructor(e,t){this.container=e,this.onKey=t,this._render()}_render(){this.container.innerHTML=`
      <div class="keyboard">
        <div class="key-row keyword-strip" id="kw-strip"></div>
        ${a.map(e=>`
          <div class="key-row">
            ${e.map(e=>`
              <div class="key ${e.cls||``}" data-action="${e.action===void 0?e.label:e.action}">
                ${e.label}
              </div>
            `).join(``)}
          </div>
        `).join(``)}
      </div>
    `;let e=this.container.querySelector(`#kw-strip`);i[0].forEach(t=>{let n=document.createElement(`div`);n.className=`key keyword`,n.dataset.action=t+` `,n.textContent=t,e.appendChild(n)}),this.container.addEventListener(`pointerdown`,e=>{let t=e.target.closest(`[data-action]`);if(!t)return;e.preventDefault(),t.classList.add(`pressed`);let n=t.dataset.action;this.onKey(n)}),this.container.addEventListener(`pointerup`,e=>{let t=e.target.closest(`[data-action]`);t&&t.classList.remove(`pressed`)})}},s=class{constructor(e){this.container=e,this._onSubmit=null,this._render()}_render(){this.container.innerHTML=`
      <div class="console-wrap" id="console-wrap">
        <div id="console-output"></div>
      </div>
      <div class="input-strip" id="input-strip">
        <span class="prompt-label" id="input-prompt"></span>
        <span id="console-input-display"></span><span class="cursor"></span>
      </div>
    `,this.outputEl=this.container.querySelector(`#console-output`),this.wrapEl=this.container.querySelector(`#console-wrap`),this.stripEl=this.container.querySelector(`#input-strip`),this.promptEl=this.container.querySelector(`#input-prompt`),this.inputDisplay=this.container.querySelector(`#console-input-display`),this._inputBuffer=``}clear(){this.outputEl.textContent=``,this._inputBuffer=``,this.hideInput()}write(e){let t=document.createTextNode(e);this.outputEl.appendChild(t),this._scrollToBottom()}writeError(e){let t=document.createElement(`span`);t.style.color=`#ff6060`,t.textContent=e,this.outputEl.appendChild(t),this._scrollToBottom()}writeBoot(){let e=document.createElement(`div`);e.className=`boot-splash`,e.textContent=`GW-BASIC  Version 2.5
Copyright (C) Michael Haardt

Ok
`,this.outputEl.appendChild(e)}showInput(e,t){this._inputBuffer=``,this._onSubmit=t,this.promptEl.textContent=e,this.inputDisplay.textContent=``,this.stripEl.classList.add(`visible`),this._scrollToBottom()}hideInput(){this.stripEl.classList.remove(`visible`),this._onSubmit=null}handleKey(e){if(!this.stripEl.classList.contains(`visible`))return!1;if(e===`
`){let e=this._inputBuffer;this._inputBuffer=``,this.inputDisplay.textContent=``,this.hideInput(),this.write(e+`
`),this._onSubmit&&this._onSubmit(e)}else e===`BACKSPACE`?(this._inputBuffer=this._inputBuffer.slice(0,-1),this.inputDisplay.textContent=this._inputBuffer):e===`LEFT`||e===`RIGHT`||(this._inputBuffer+=e,this.inputDisplay.textContent=this._inputBuffer);return!0}_scrollToBottom(){requestAnimationFrame(()=>{this.wrapEl.scrollTop=this.wrapEl.scrollHeight})}},c=`basic_file_`,l=`basic_file_index`;function u(){try{return JSON.parse(localStorage.getItem(l)||`[]`)}catch{return[]}}function d(e){localStorage.setItem(l,JSON.stringify(e))}function f(){return u().map(e=>{try{return{name:e,modified:JSON.parse(localStorage.getItem(c+e)||`{}`).modified||0}}catch{return{name:e,modified:0}}}).sort((e,t)=>t.modified-e.modified)}function p(e){try{let t=JSON.parse(localStorage.getItem(c+e));return t?t.source:null}catch{return null}}function m(e,t){let n=u();n.includes(e)||(n.push(e),d(n)),localStorage.setItem(c+e,JSON.stringify({source:t,modified:Date.now()}))}function h(e){d(u().filter(t=>t!==e)),localStorage.removeItem(c+e)}function g(e){let t=p(e);if(t===null)return;let n=new Blob([t],{type:`text/plain`}),r=document.createElement(`a`);r.href=URL.createObjectURL(n),r.download=e.endsWith(`.bas`)?e:e+`.bas`,r.click(),URL.revokeObjectURL(r.href)}function _(e){let t=document.createElement(`input`);t.type=`file`,t.accept=`.bas,.txt`,t.onchange=t=>{let n=t.target.files[0];if(!n)return;let r=new FileReader;r.onload=t=>{let r=n.name.replace(/\.(bas|txt)$/i,``).toUpperCase();r||=`UNTITLED`,m(r,t.target.result),e(r)},r.readAsText(n)},t.click()}var v=class{constructor(e,t){this.container=e,this.onOpen=t,this._render()}_render(){this.container.innerHTML=`
      <div class="file-overlay" id="file-overlay">
        <div class="file-panel">
          <div class="file-panel-header">
            <h2>FILES</h2>
            <button id="file-close">✕</button>
          </div>
          <div class="file-panel-actions">
            <button id="file-new">NEW</button>
            <button id="file-import">IMPORT</button>
          </div>
          <div class="file-list" id="file-list"></div>
        </div>
      </div>
    `,this.overlay=this.container.querySelector(`#file-overlay`),this.listEl=this.container.querySelector(`#file-list`),this.container.querySelector(`#file-close`).addEventListener(`click`,()=>this.hide()),this.overlay.addEventListener(`click`,e=>{e.target===this.overlay&&this.hide()}),this.container.querySelector(`#file-new`).addEventListener(`click`,()=>{let e=prompt(`Program name:`);if(!e)return;let t=e.toUpperCase();m(t,`10 `),this.onOpen(t,`10 `),this.hide()}),this.container.querySelector(`#file-import`).addEventListener(`click`,()=>{_(e=>{let t=p(e);this.onOpen(e,t||``),this.hide()})})}show(){this._refreshList(),this.overlay.classList.add(`open`)}hide(){this.overlay.classList.remove(`open`)}_refreshList(){let e=f();if(e.length===0){this.listEl.innerHTML=`<div class="file-item"><span class="file-meta">No saved programs</span></div>`;return}this.listEl.innerHTML=e.map(e=>`
      <div class="file-item" data-name="${b(e.name)}">
        <div>
          <div class="file-name">${y(e.name)}</div>
          <div class="file-meta">${e.modified?new Date(e.modified).toLocaleDateString():``}</div>
        </div>
        <div class="file-item-actions">
          <button class="export-btn" data-name="${b(e.name)}">EXP</button>
          <button class="delete-btn" data-name="${b(e.name)}">DEL</button>
        </div>
      </div>
    `).join(``),this.listEl.querySelectorAll(`.file-item`).forEach(e=>{e.addEventListener(`click`,t=>{if(t.target.classList.contains(`export-btn`)){g(t.target.dataset.name);return}if(t.target.classList.contains(`delete-btn`)){let e=t.target.dataset.name;confirm(`Delete ${e}?`)&&(h(e),this._refreshList());return}let n=e.dataset.name,r=p(n);r!==null&&(this.onOpen(n,r),this.hide())})})}};function y(e){return String(e).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`)}function b(e){return String(e).replace(/"/g,`&quot;`)}var x=`UNTITLED`,S=`10 PRINT "HELLO, WORLD!"
20 GOTO 10
`,C=class{constructor(){this.currentFile=x,this.mode=`edit`,this._basModule=null,this._running=!1,this._buildDOM(),this._initComponents(),this._loadLastFile()}_buildDOM(){document.querySelector(`#app`).innerHTML=`
      <!-- Toolbar -->
      <div class="toolbar" id="toolbar">
        <button id="btn-files">☰ FILES</button>
        <span class="filename" id="filename">${x}.BAS</span>
        <button class="primary" id="btn-run">▶ RUN</button>
      </div>

      <!-- Edit Mode -->
      <div class="mode-panel active" id="edit-mode">
        <div id="editor-container" style="flex:1;overflow:hidden;display:flex;flex-direction:column;"></div>
        <div id="keyboard-container"></div>
      </div>

      <!-- Run Mode -->
      <div class="mode-panel" id="run-mode">
        <div id="console-container" style="flex:1;overflow:hidden;display:flex;flex-direction:column;"></div>
      </div>

      <!-- File browser (portal) -->
      <div id="filebrowser-container"></div>
    `}_initComponents(){this.editor=new r(document.querySelector(`#editor-container`)),this.console=new s(document.querySelector(`#console-container`)),this.keyboard=new o(document.querySelector(`#keyboard-container`),e=>this._onKey(e)),this.browser=new v(document.querySelector(`#filebrowser-container`),(e,t)=>{this.currentFile=e,this.editor.setSource(t),this._updateFilename()}),document.querySelector(`#btn-files`).addEventListener(`click`,()=>this.browser.show()),document.querySelector(`#btn-run`).addEventListener(`click`,()=>this._startRun())}_onKey(e){this.mode===`run`?this.console.handleKey(e):this.editor.insertText(e)}_loadLastFile(){let e=localStorage.getItem(`basic_last_file`),t=e?p(e):null;e&&t!==null?(this.currentFile=e,this.editor.setSource(t)):this.editor.setSource(S),this._updateFilename()}_saveCurrentFile(){let e=this.editor.getSource();m(this.currentFile,e),localStorage.setItem(`basic_last_file`,this.currentFile)}_updateFilename(){let e=this.currentFile.endsWith(`.BAS`)?this.currentFile:this.currentFile+`.BAS`;document.querySelector(`#filename`).textContent=e,localStorage.setItem(`basic_last_file`,this.currentFile)}_enterEditMode(){this.mode=`edit`,this._running=!1,document.querySelector(`#edit-mode`).classList.add(`active`),document.querySelector(`#run-mode`).classList.remove(`active`);let e=document.querySelector(`#toolbar`);e.innerHTML=`
      <button id="btn-files">☰ FILES</button>
      <span class="filename" id="filename"></span>
      <button class="primary" id="btn-run">▶ RUN</button>
    `,this._updateFilename(),document.querySelector(`#btn-files`).addEventListener(`click`,()=>this.browser.show()),document.querySelector(`#btn-run`).addEventListener(`click`,()=>this._startRun()),document.querySelector(`#keyboard-container`).style.display=``}_enterRunMode(){this.mode=`run`,document.querySelector(`#edit-mode`).classList.remove(`active`),document.querySelector(`#run-mode`).classList.add(`active`),document.querySelector(`#keyboard-container`).style.display=`none`;let e=document.querySelector(`#toolbar`);e.innerHTML=`
      <button id="btn-edit">◀ EDIT</button>
      <span class="filename" id="filename" style="color:var(--green-dim)">RUNNING…</span>
      <button class="danger" id="btn-stop">■ STOP</button>
    `,document.querySelector(`#btn-edit`).addEventListener(`click`,()=>{this._stopRun(),this._enterEditMode()}),document.querySelector(`#btn-stop`).addEventListener(`click`,()=>{this._stopRun(),document.querySelector(`#filename`).textContent=`STOPPED`})}async _startRun(){this._saveCurrentFile(),this._enterRunMode(),this.console.clear();let e=this.editor.getSource();if(!e.trim()){this.console.write(`No program to run.
`);return}try{await this._runBas(e)}catch(e){this.console.writeError(`\nInternal error: ${e.message}\n`)}this._running&&=(this.console.write(`
Ok
`),document.querySelector(`#filename`)&&(document.querySelector(`#filename`).textContent=`DONE`),!1)}_stopRun(){this._running=!1,window.BAS_IO&&window.BAS_IO._inputResolve&&(window.BAS_IO._inputResolve(``),window.BAS_IO._inputResolve=null)}async _runBas(e){if(!this._basModule){if(typeof createBasModule>`u`){this.console.writeError(`WASM interpreter not loaded.
`);return}this._basModule=await createBasModule()}let t=window.BAS_IO;t.onOutput=e=>{this._running&&this.console.write(e)},t.onError=e=>{this.console.writeError(e)},t.onInputNeeded=()=>{this.console.showInput(`? `,e=>{t.provideInput(e)}),document.querySelector(`#keyboard-container`).style.display=``};let n=this._basModule,r=new TextEncoder().encode(e);n.FS.writeFile(`/program.bas`,r),this._running=!0,n.callMain([`/program.bas`])}};window.addEventListener(`DOMContentLoaded`,()=>{document.title=`BASIC`,new C})})();