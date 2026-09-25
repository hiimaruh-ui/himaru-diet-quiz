/* =========================================================
   診断の動き（ふだんは編集不要です）
   文章や配点を変えたいときは config.js を編集してください。
   ========================================================= */
(function () {
  "use strict";

  var C = window.QUIZ_CONFIG;
  var TYPE_KEYS = ["A", "B", "C", "D", "E"];
  var questions = C.questions;
  var answers = [];      // answers[i] = 選んだ選択肢のタイプ（"A"〜"E"）
  var current = 0;
  var locked = false;

  var $ = function (id) { return document.getElementById(id); };

  function show(name) {
    ["start", "question", "result"].forEach(function (s) {
      $("screen-" + s).hidden = s !== name;
    });
    window.scrollTo(0, 0);
  }

  /* ---------- 判定 ---------- */

  function answerOf(qId) {
    for (var i = 0; i < questions.length; i++) {
      if (questions[i].id === qId) return answers[i];
    }
    return undefined;
  }

  function optionOf(qIndex) {
    var q = questions[qIndex];
    for (var i = 0; i < q.options.length; i++) {
      if (q.options[i].type === answers[qIndex]) return q.options[i];
    }
    return null;
  }

  // 同点候補の中から、指定した質問の順に回答を見て最初に当てはまるタイプを選ぶ
  function breakTie(candidates, order) {
    if (candidates.length === 1) return candidates[0];
    for (var i = 0; i < order.length; i++) {
      var a = answerOf(order[i]);
      if (a && candidates.indexOf(a) !== -1) return a;
    }
    return candidates[0];
  }

  function topTypes(scores, exclude) {
    var max = -1, list = [];
    TYPE_KEYS.forEach(function (k) {
      if (k === exclude) return;
      if (scores[k] > max) { max = scores[k]; list = [k]; }
      else if (scores[k] === max) { list.push(k); }
    });
    return { max: max, list: list };
  }

  function calculate() {
    var votes = {}, related = {};
    TYPE_KEYS.forEach(function (k) { votes[k] = 0; related[k] = 0; });

    questions.forEach(function (q, i) {
      var opt = optionOf(i);
      if (!opt) return;
      if (q.main) votes[opt.type] += 1;
      Object.keys(opt.related || {}).forEach(function (k) {
        related[k] += opt.related[k];
      });
    });

    var mainTop = topTypes(votes);
    var main = breakTie(mainTop.list, C.tieBreak.mainFirst);

    var subTop = topTypes(related, main);
    var sub = subTop.max > 0 ? breakTie(subTop.list, C.tieBreak.subFirst) : null;

    return { main: main, sub: sub, related: related };
  }

  /* ---------- 画面の表示 ---------- */

  function renderStart() {
    var s = C.start;
    $("start-title").textContent = s.titleDisplay || s.title;
    $("start-subtitle-small").textContent = s.subtitleSmall;
    $("start-subtitle").textContent = s.subtitle;
    $("start-lead").textContent = s.lead;
    $("start-body").textContent = s.body;
    $("start-button").textContent = s.button;
    $("start-note").textContent = s.note;
  }

  function renderQuestion() {
    var q = questions[current];
    var total = questions.length;
    $("q-current").textContent = current + 1;
    $("q-total").textContent = total;
    $("q-label").textContent = "Q" + (current + 1);
    $("q-text").textContent = q.text;
    $("progress").setAttribute("aria-valuemax", total);
    $("progress").setAttribute("aria-valuenow", current + 1);
    $("progress-fill").style.width = ((current + 1) / total * 100) + "%";

    var box = $("options");
    box.innerHTML = "";
    q.options.forEach(function (opt) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "option" + (answers[current] === opt.type ? " is-selected" : "");
      b.textContent = opt.text;
      b.addEventListener("click", function () { choose(opt.type, b); });
      box.appendChild(b);
    });

    var body = $("q-body");
    body.classList.remove("is-entering");
    void body.offsetWidth;
    body.classList.add("is-entering");
    locked = false;
  }

  function choose(type, button) {
    if (locked) return;
    locked = true;
    answers[current] = type;
    Array.prototype.forEach.call($("options").children, function (el) {
      el.classList.toggle("is-selected", el === button);
    });
    setTimeout(function () {
      if (current < questions.length - 1) {
        current += 1;
        renderQuestion();
        window.scrollTo(0, 0);
      } else {
        renderResult();
        show("result");
      }
    }, 280);
  }

  function renderResult() {
    var r = calculate();
    var R = C.result;
    var t = C.types[r.main];

    $("result-heading").textContent = R.heading;
    $("result-emoji").textContent = t.emoji;
    $("result-type").textContent = t.label;

    var sub = $("result-sub");
    if (r.sub) {
      var st = C.types[r.sub];
      sub.textContent = st.emoji + " " + st.tendency + R.subSuffix;
      sub.hidden = false;
    } else {
      sub.hidden = true;
    }

    var text = $("result-text");
    text.innerHTML = "";
    t.text.forEach(function (line) {
      var p = document.createElement("p");
      p.textContent = line;
      text.appendChild(p);
    });

    $("result-step-label").textContent = R.stepLabel;
    $("result-step-text").textContent = "「" + t.step + "」";

    // 傾向バー（数値は出さず、いちばん多いものを満タンとした長さだけで表示）
    $("bars-title").textContent = R.barsTitle;
    $("bars-note").textContent = R.barsNote;
    var max = Math.max.apply(null, TYPE_KEYS.map(function (k) { return r.related[k]; })) || 1;
    var list = $("bars-list");
    list.innerHTML = "";
    TYPE_KEYS.forEach(function (k) {
      var ty = C.types[k];
      var li = document.createElement("li");
      li.className = "bar" + (k === r.main ? " is-main" : "") + (k === r.sub ? " is-sub" : "");
      li.innerHTML =
        '<span class="bar-name"><span class="bar-emoji" aria-hidden="true"></span><span class="bar-label"></span></span>' +
        '<span class="bar-track"><span class="bar-fill"></span></span>';
      li.querySelector(".bar-emoji").textContent = ty.emoji;
      li.querySelector(".bar-label").textContent = ty.tendency;
      var w = Math.max(6, Math.round(r.related[k] / max * 100));
      li.querySelector(".bar-fill").style.width = w + "%";
      list.appendChild(li);
    });

    $("result-brand").textContent = C.start.title;
    $("result-closing").textContent = R.closing;
    $("disclaimer").textContent = R.disclaimer;
    $("retry-button").textContent = R.retry;

    var cta = C.cta || {};
    $("cta").hidden = !cta.show;
    if (cta.show) {
      $("cta-lead").textContent = cta.lead || "";
      $("cta-link").textContent = cta.text;
      $("cta-link").href = cta.url;
    }
  }

  /* ---------- ボタン ---------- */

  $("start-button").addEventListener("click", function () {
    answers = [];
    current = 0;
    renderQuestion();
    show("question");
  });

  $("back-button").addEventListener("click", function () {
    if (current === 0) {
      show("start");
    } else {
      current -= 1;
      renderQuestion();
    }
  });

  $("retry-button").addEventListener("click", function () {
    answers = [];
    current = 0;
    show("start");
  });

  renderStart();
  show("start");
})();
