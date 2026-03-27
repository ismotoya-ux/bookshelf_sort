// Bookshelf sort game (1..100) - local web app
const $ = (id) => document.getElementById(id);
const shelf = $("shelf");
const timeEl = $("time");
const movesEl = $("moves");
const countEl = $("count");
const goalMaxEl = $("goalMax");
const msgEl = $("msg");
const startBtn = $("start");
const shuffleBtn = $("shuffle");
const resetBtn = $("reset");
const accEl = $("accuracy");
const streakEl = $("streak");

let order = [];
let N = 100;
let draggingIdx = null;
let running = false;
let startTime = 0;
let timerHandle = null;
let moves = 0;

const touchMode = (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || window.matchMedia?.("(pointer: coarse)").matches;

let ghostEl = null;
let overEl = null;
let pointerActive = false;

function clearOver(){
  if (overEl){ overEl.classList.remove("over"); overEl = null; }
}
function removeGhost(){
  if (ghostEl){ ghostEl.remove(); ghostEl = null; }
}
function setOver(el){
  if (overEl === el) return;
  clearOver();
  overEl = el;
  if (overEl) overEl.classList.add("over");
}
function createGhost(fromEl, x, y){
  removeGhost();
  const g = fromEl.cloneNode(true);
  g.classList.add("ghost");
  g.classList.remove("over");
  g.classList.remove("dragging");
  document.body.appendChild(g);
  ghostEl = g;
  moveGhost(x, y);
}
function moveGhost(x, y){
  if (!ghostEl) return;
  ghostEl.style.left = x + "px";
  ghostEl.style.top = y + "px";
}

function pad2(n){ return String(n).padStart(2,"0"); }
function fmtTime(ms){
  const t = Math.max(0, ms);
  const totalSec = t/1000;
  const m = Math.floor(totalSec/60);
  const s = Math.floor(totalSec%60);
  const ds = Math.floor((t%1000)/100);
  return `${pad2(m)}:${pad2(s)}.${ds}`;
}

function startTimer(){
  if (running) return;
  running = true;
  startTime = performance.now();
  timerHandle = setInterval(() => {
    timeEl.textContent = fmtTime(performance.now() - startTime);
  }, 100);
}
function stopTimer(){
  if (!running) return;
  running = false;
  clearInterval(timerHandle);
  timerHandle = null;
}
function setMessage(html){ msgEl.innerHTML = html || ""; }


function clampN(v){
  const n = Math.max(5, Math.min(100, Math.round(Number(v) || 100)));
  return n;
}
function setGridColumns(n){
  // 5〜10列で見やすく（小さいNでもスカスカになりすぎない）
  const cols = Math.min(10, Math.max(5, Math.ceil(Math.sqrt(n))));
  shelf.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
}

function shuffleArray(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function makeRandom(){
  order = Array.from({length:N}, (_,i)=>i+1);
  shuffleArray(order);
  if (isSolved(order)) shuffleArray(order);
}
function makeSolved(){
  order = Array.from({length:N}, (_,i)=>i+1);
}
function isSolved(arr){
  for (let i=0;i<N;i++) if (arr[i] !== i+1) return false;
  return true;
}
function accuracy(arr){
  let ok = 0;
  for (let i=0;i<N;i++) if (arr[i] === i+1) ok++;
  return Math.round((ok / N) * 100);
}
function streak(arr){
  let s = 0;
  for (let i=0;i<N;i++){
    if (arr[i] === i+1) s++;
    else break;
  }
  return s;
}

function render(){
  shelf.innerHTML = "";
  for (let i=0;i<order.length;i++){
    const n = order[i];
    const div = document.createElement("div");
    div.className = "book";
    div.draggable = !touchMode;
    div.dataset.idx = String(i);
    div.textContent = String(n);

    
    if (!touchMode) {
div.addEventListener("dragstart", (e) => {
      draggingIdx = Number(div.dataset.idx);
      div.classList.add("dragging");
      e.dataTransfer?.setData("text/plain", String(n));
      e.dataTransfer?.setDragImage(div, 20, 20);
      if (!running) startTimer();
    });

    div.addEventListener("dragend", () => {
      draggingIdx = null;
      div.classList.remove("dragging");
      shelf.querySelectorAll(".book.over").forEach(x=>x.classList.remove("over"));
    });

    div.addEventListener("dragover", (e) => {
      e.preventDefault();
      div.classList.add("over");
    });
    div.addEventListener("dragleave", () => div.classList.remove("over"));

    div.addEventListener("drop", (e) => {
      e.preventDefault();
      div.classList.remove("over");
      const targetIdx = Number(div.dataset.idx);
      if (draggingIdx == null || targetIdx === draggingIdx) return;

      [order[draggingIdx], order[targetIdx]] = [order[targetIdx], order[draggingIdx]];
      moves++;
      movesEl.textContent = String(moves);

      render();
      updateStats();
      checkClear();
    });
    } else {
      // Pointer/touch drag (swap)
      div.addEventListener("pointerdown", (e) => {
        if (pointerActive) return;
        pointerActive = true;
        draggingIdx = Number(div.dataset.idx);
        div.classList.add("dragging");
        if (!running) startTimer();

        // Capture pointer so we keep receiving events
        try { div.setPointerCapture(e.pointerId); } catch {}

        createGhost(div, e.clientX, e.clientY);

        const onMove = (ev) => {
          moveGhost(ev.clientX, ev.clientY);
          const el = document.elementFromPoint(ev.clientX, ev.clientY);
          const book = el?.closest?.(".book");
          if (book && shelf.contains(book)) {
            setOver(book);
          } else {
            clearOver();
          }
        };

        const onUp = (ev) => {
          // finalize
          try { div.releasePointerCapture(e.pointerId); } catch {}
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onUp);
          document.removeEventListener("pointercancel", onUp);

          div.classList.remove("dragging");
          removeGhost();

          const el = document.elementFromPoint(ev.clientX, ev.clientY);
          const book = el?.closest?.(".book");
          const targetIdx = book && shelf.contains(book) ? Number(book.dataset.idx) : null;
          clearOver();

          if (draggingIdx != null && targetIdx != null && targetIdx !== draggingIdx) {
            // swap
            [order[draggingIdx], order[targetIdx]] = [order[targetIdx], order[draggingIdx]];
            moves++;
            movesEl.textContent = String(moves);
            render();
            updateStats();
            checkClear();
          }

          draggingIdx = null;
          pointerActive = false;
        };

        document.addEventListener("pointermove", onMove, { passive: false });
        document.addEventListener("pointerup", onUp);
        document.addEventListener("pointercancel", onUp);
        e.preventDefault();
      });
    }

    shelf.appendChild(div);
  }
}

function updateStats(){
  accEl.textContent = String(accuracy(order));
  streakEl.textContent = String(streak(order));
}

function checkClear(){
  if (!isSolved(order)) return;
  stopTimer();
  setMessage(`<span class="ok">クリア！</span> タイム：<span class="mono">${timeEl.textContent}</span> ／ 手数：<span class="mono">${moves}</span>`);
}

function newGameRandom(){
  N = clampN(countEl.value);
  countEl.value = String(N);
  goalMaxEl.textContent = String(N);
  setGridColumns(N);

  stopTimer();
  timeEl.textContent = "00:00.0";
  moves = 0;
  movesEl.textContent = "0";
  setMessage("");
  makeRandom();
  render();
  updateStats();
}
function newGameSolved(){
  N = clampN(countEl.value);
  countEl.value = String(N);
  goalMaxEl.textContent = String(N);
  setGridColumns(N);

  stopTimer();
  timeEl.textContent = "00:00.0";
  moves = 0;
  movesEl.textContent = "0";
  setMessage("<span class='small'>リセットしました（1〜100順）。シャッフルでゲーム開始！</span>");
  makeSolved();
  render();
  updateStats();
}

startBtn.addEventListener("click", () => {
  // Start always shuffles and begins the game
  newGameRandom();
  startTimer();
  setMessage("<span class='small'>スタート！シャッフルしました。ドラッグで入れ替えて並べ替えてね。</span>");
});
shuffleBtn.addEventListener("click", () => {
  newGameRandom();
  setMessage("<span class='small'>シャッフルしました。がんばれ〜！</span>");
});
resetBtn.addEventListener("click", newGameSolved);

// init
newGameRandom();
