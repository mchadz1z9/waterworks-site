// content-loader.js
// Include this on any page with: <script src="/content-loader.js"></script>
//
// HOW IT WORKS: put a "data-content" attribute on any HTML element where you
// want text to come from content.json instead of being hard-coded. Example:
//
//   <h1 data-content="hero_title">WaterWorks Lawn & Landscaping</h1>
//   <p data-content="hero_subtitle">...</p>
//   <p data-content="contact_phone">...</p>
//
// The text already in the tag is just a fallback shown for a split second
// before content.json loads, and shown permanently if content.json fails to
// load for some reason. Editing content.json on GitHub and pushing is the
// only step needed to change any of these — no rebuild, no admin panel.
//
// For the services list, add a container with id="services-list":
//   <div id="services-list"></div>
// It will be filled in with one block per service automatically.
//
// For reviews, add a container with id="reviews-list":
//   <div id="reviews-list"></div>
// It will be filled in with one block per review automatically.

(function () {
  fetch("/content.json", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      // Fill in any element with a matching data-content attribute
      document.querySelectorAll("[data-content]").forEach(function (el) {
        var key = el.getAttribute("data-content");
        if (data[key] !== undefined && data[key] !== "") {
          el.textContent = data[key];
        }
      });

      // Render services list, if present on the page
      var servicesEl = document.getElementById("services-list");
      if (servicesEl && Array.isArray(data.services)) {
        servicesEl.innerHTML = "";
        data.services.forEach(function (s) {
          var block = document.createElement("div");
          block.className = "service-item";
          var priceText = s.price ? (" — " + s.price) : "";
          block.innerHTML =
            "<h3>" + escapeHtml(s.name) + priceText + "</h3>" +
            "<p>" + escapeHtml(s.description || "") + "</p>";
          servicesEl.appendChild(block);
        });
      }

      // Render reviews list, if present on the page
      var reviewsEl = document.getElementById("reviews-list");
      if (reviewsEl && Array.isArray(data.reviews)) {
        reviewsEl.innerHTML = "";
        data.reviews.forEach(function (r) {
          var block = document.createElement("div");
          block.className = "review-item";
          var stars = "★★★★★".slice(0, r.rating) + "☆☆☆☆☆".slice(0, 5 - r.rating);
          block.innerHTML =
            "<div class='review-stars'>" + stars + "</div>" +
            "<p>" + escapeHtml(r.comment) + "</p>" +
            "<p class='review-name'>— " + escapeHtml(r.name) + "</p>";
          reviewsEl.appendChild(block);
        });
      }
    })
    .catch(function (err) {
      console.warn("content.json failed to load, showing default page text.", err);
    });

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.innerText = s || "";
    return d.innerHTML;
  }
})();
