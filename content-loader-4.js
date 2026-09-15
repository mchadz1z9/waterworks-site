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
  // Team section — data is written directly here so nothing needs to be
  // fetched separately and nothing else can go wrong.
  var TEAM = [
    {
      name: "Noah Carter",
      role: "Co-Founder",
      bio: "Been part of building WaterWorks from day one and helps run the crew on every job."
    },
    {
      name: "Noah",
      role: "Crew Member",
      bio: "Dependable and hardworking, showing up ready to get the job done right."
    }
  ];

  function renderTeam() {
    if (document.getElementById("team-list")) return; // already added
    var teamSection = document.createElement("section");
    teamSection.className = "team-section";
    teamSection.innerHTML = "<h2>Our Team</h2>";
    var teamEl = document.createElement("div");
    teamEl.id = "team-list";
    teamSection.appendChild(teamEl);

    var footer2 = document.querySelector("footer");
    if (footer2) {
      footer2.parentNode.insertBefore(teamSection, footer2);
    } else {
      document.body.appendChild(teamSection);
    }

    TEAM.forEach(function (t) {
      var block = document.createElement("div");
      block.className = "team-item";
      block.innerHTML =
        "<h3>" + escapeHtml(t.name) + "</h3>" +
        "<p class='team-role'>" + escapeHtml(t.role || "") + "</p>" +
        "<p>" + escapeHtml(t.bio || "") + "</p>";
      teamEl.appendChild(block);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderTeam);
  } else {
    renderTeam();
  }

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

      // Render reviews list. If the page doesn't already have a
      // reviews-list container, create one automatically (right before
      // the footer if there is one, otherwise at the end of the page)
      // so no manual HTML editing is needed.
      var reviewsEl = document.getElementById("reviews-list");
      if (!reviewsEl && Array.isArray(data.reviews) && data.reviews.length > 0) {
        var section = document.createElement("section");
        section.className = "reviews-section";
        section.innerHTML = "<h2>Customer Reviews</h2>";
        reviewsEl = document.createElement("div");
        reviewsEl.id = "reviews-list";
        section.appendChild(reviewsEl);

        var footer = document.querySelector("footer");
        if (footer) {
          footer.parentNode.insertBefore(section, footer);
        } else {
          document.body.appendChild(section);
        }
      }
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
