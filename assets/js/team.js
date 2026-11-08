/* Team page: filter team members by department (buttons with data-filter, cards with data-group). */
(function () {
  "use strict";
  var grid = document.querySelector("[data-team-grid]");
  if (!grid) return;
  var buttons = document.querySelectorAll(".tm-filter__btn");
  var empty = document.querySelector("[data-team-empty]");
  buttons.forEach(function (b) {
    b.addEventListener("click", function () {
      var f = b.getAttribute("data-filter"), shown = 0;
      buttons.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      grid.querySelectorAll(".tm3").forEach(function (c) {
        var on = f === "all" || c.getAttribute("data-group") === f;
        c.hidden = !on; if (on) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    });
  });
})();
