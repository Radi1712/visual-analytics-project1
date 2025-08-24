import * as d3 from "d3";

// Chart size
const width = 600;
const height = 600;
const radius = Math.min(width, height) / 2;
const innerRadius = radius * 0.4;

// Color palette
const colors = [
  "#4e79a7",
  "#59a14f",
  "#9cce6b",
  "#f1e05a",
  "#f1c05a",
  "#f28e2b",
  "#e15759",
  "#d94f4f",
  "#c52e3a",
  "#b11226",
];

// Global mapping of category names to fixed colors
const categoryColorMap = new Map();
const ldaCategoryColorMap = new Map(Object.entries({
  "Fantasy": "#1f77b4",
  "Adventure": "#ff7f0e",
  "Economic": "#2ca02c",
  "Science Fiction": "#d62728",
  "Fighting": "#9467bd",
}));

// SVG setup with extra vertical space for the title
const svgContainer = d3
  .select("#chart")
  .attr("width", width)
  .attr("height", height + 60); // add extra height for title

// Add the title (at the top)
svgContainer
  .append("text")
  .attr("x", width / 2)
  .attr("y", 30)
  .attr("text-anchor", "middle")
  .style("font-size", "18px")
  .style("font-weight", "bold")
  .style("font-family", "sans-serif")
  .text("Top Board Game Categories by Count (Filtered by Min Age)");

// padding
const svg = svgContainer
  .append("g")
  .attr("transform", `translate(${width / 2}, ${(height / 2) + 60})`);

// Tooltip
const tooltip = d3
  .select("body")
  .append("div")
  .style("position", "absolute")
  .style("background", "#fff")
  .style("border-radius", "8px")
  .style("padding", "10px")
  .style("box-shadow", "0 4px 12px rgba(0,0,0,0.2)")
  .style("pointer-events", "none")
  .style("opacity", 0)
  .style("font-family", "sans-serif");

d3.json("./boardgames_40.json").then((data) => {
  const allData = data;

  const uniqueAges = Array.from(
    new Set(allData.map((d) => d.minage).filter((d) => d != null))
  ).sort((a, b) => a - b);

  // Create checkboxes
  const checkboxContainer = d3
    .select("#age-controls")
    .append("div")
    .style("margin", "20px")
    .style("font-family", "sans-serif")
    .html(`<strong>Select Min Age(s):</strong><br/>`);

  uniqueAges.forEach((age) => {
    checkboxContainer.append("label").style("margin-right", "10px").html(`
        <input type="checkbox" class="minage-checkbox" value="${age}" checked />
        ${age}
      `);
  });

  // Add listener
  d3.selectAll(".minage-checkbox").on("change", () => {
    const selectedAges = getSelectedAges();
    updateChart(selectedAges);
  });

  // Helper to get selected minages
  function getSelectedAges() {
    return d3
      .selectAll(".minage-checkbox")
      .nodes()
      .filter((node) => node.checked)
      .map((node) => +node.value);
  }

  // Initial chart
  updateChart(getSelectedAges());

  function updateChart(selectedAges) {
    const categoryMap = new Map();

    allData.forEach((game) => {
      const gameAge = game.minage ?? null;
      if (selectedAges.includes(gameAge)) {
        const rating = game.rating?.rating ?? 0;
        game.types?.categories?.forEach((category) => {
          const cat = category.name;
          if (!categoryMap.has(cat)) {
            categoryMap.set(cat, {
              count: 1,
              topGame: game,
            });
          } else {
            const entry = categoryMap.get(cat);
            entry.count += 1;
            if (rating > (entry.topGame.rating?.rating ?? 0)) {
              entry.topGame = game;
            }
          }
        });
      }
    });

    const topCategories = Array.from(categoryMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([name, { count, topGame }], i) => {
        if (!categoryColorMap.has(name)) {
          categoryColorMap.set(name, colors[categoryColorMap.size % colors.length]);
        }
        return {
          name,
          count,
          topGame,
        };
      });

    const pie = d3
      .pie()
      .value((d) => d.count)
      .sort(null);
    const arc = d3.arc().innerRadius(innerRadius).outerRadius(radius);
    const labelArc = d3
      .arc()
      .innerRadius(radius * 0.7)
      .outerRadius(radius * 0.7);
    const pieData = pie(topCategories);

    // JOIN paths
    const paths = svg.selectAll("path").data(pieData, (d) => d.data.name);

    paths.exit().remove();

    paths
      .join(
        (enter) =>
          enter
            .append("path")
            .attr("fill", (d) => categoryColorMap.get(d.data.name))
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .attr("d", arc)
            .each(function (d) {
              this._current = d;
            }),
        (update) =>
          update
            .transition()
            .duration(750)
            .attrTween("d", function (d) {
              const i = d3.interpolate(this._current, d);
              this._current = i(1);
              return (t) => arc(i(t));
            })
      )
      .on("mouseover", (event, d) => {
        const topGame = d.data.topGame;
        if (!topGame || !topGame.title) return;

        tooltip.style("opacity", 1).html(
          `<strong>${d.data.name}</strong><br/>
           Top Game: <strong>${topGame.title}</strong><br/>
           ⭐ Rating: ${topGame.rating?.rating?.toFixed(2) ?? "N/A"}<br/>
           📆 Year: ${topGame.year ?? "N/A"}<br/>
           👥 Players: ${topGame.minplayers ?? "?"} - ${
            topGame.maxplayers ?? "?"
          }<br/>
           🎯 Min Age: ${topGame.minage ?? "?"}<br/>
           ⏱️ Playtime: ${topGame.minplaytime ?? "?"} - ${
            topGame.maxplaytime ?? "?"
          } min`
        );
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", `${event.pageX + 12}px`)
          .style("top", `${event.pageY - 28}px`);
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });

    // JOIN labels
    const labels = svg.selectAll("text").data(pieData, (d) => d.data.name);

    labels.exit().remove();

    labels.join(
      (enter) =>
        enter
          .append("text")
          .attr("text-anchor", "middle")
          .attr("alignment-baseline", "middle")
          .style("font-family", "'Inter', 'Segoe UI', sans-serif")
          .style("font-size", "13px")
          .style("font-weight", "500")
          .style("fill", "#fff")
          .attr("transform", (d) => `translate(${labelArc.centroid(d)})`)
          .text((d) => d.data.name),
      (update) =>
        update
          .transition()
          .duration(750)
          .attr("transform", (d) => `translate(${labelArc.centroid(d)})`)
          .text((d) => d.data.name)
    );
  }
});

//------------------------------------------------------

// LDA scatterplot – now with category selection
import { LDA, Matrix } from "@saehrimnir/druidjs";

// Global reference for reuse
let ldaRawData = [];

function getSelectedCategories() {
  return Array.from(document.querySelectorAll('#category-controls input[type="checkbox"]'))
    .filter(cb => cb.checked)
    .map(cb => cb.value);
}

function standardise(A) {
  const m = A.length,
    n = A[0].length;
  const means = Array(n).fill(0),
    stds = Array(n).fill(0);

  A.forEach((r) => r.forEach((v, i) => (means[i] += v)));
  means.forEach((s, i) => (means[i] = s / m));

  A.forEach((r) => r.forEach((v, i) => (stds[i] += (v - means[i]) ** 2)));
  stds.forEach((s, i) => (stds[i] = Math.sqrt(s / m) || 1));

  return A.map((r) => r.map((v, i) => (v - means[i]) / stds[i]));
}

function updateLDAPlot(selectedCategories) {
  // Remove any previous tooltip div
  d3.selectAll("div.tooltip").remove();

  // Create a new tooltip (once per update)
  const ldaTooltip = d3
    .select("body")
    .append("div")
    .attr("class", "ldaTooltip")
    .style("position", "absolute")
    .style("background", "#fff")
    .style("border", "1px solid #ccc")
    .style("padding", "10px")
    .style("pointer-events", "none")
    .style("opacity", 0);

  d3.select("#ldaPlot").selectAll("*").remove();

  const rawData = ldaRawData;
  const data = [], labels = [], labelNames = [], games = [];

  rawData.forEach((game) => {
    const cat = game.types?.categories?.[0]?.name;
    if (!cat || !selectedCategories.includes(cat)) return;

    const row = [
      +game.minplayers ?? 0,
      +game.maxplayers ?? 0,
      +game.minplaytime ?? 0,
      +game.maxplaytime ?? 0,
      +game.minage ?? 0,
      +(game.rating?.rating ?? 0),
      +(game.rating?.num_of_reviews ?? 0),
    ];

    if (row.some((v) => Number.isNaN(v))) return;

    data.push(row);
    labels.push(selectedCategories.indexOf(cat));
    labelNames.push(cat);
    games.push(game);

    // Assign a consistent color to each category if not already set
    if (!ldaCategoryColorMap.has(cat)) {
      ldaCategoryColorMap.set(cat, colorPalette[ldaCategoryColorMap.size % colorPalette.length]);
    }
  });

  if (data.length < 2 || selectedCategories.length < 2) {
    d3.select("#ldaPlot")
      .append("text")
      .attr("x", 20)
      .attr("y", 20)
      .text("Please select at least two categories with data.");
    return;
  }

  const Xmatrix = Matrix.from(standardise(data));
  const lda = new LDA(Xmatrix, { labels, d: 2 });
  lda.transform();
  const projected = lda.projection.to2dArray;

  const margin = { top: 20, right: 160, bottom: 40, left: 50 };
  const outerW = 760,
    outerH = 500;
  const width = outerW - margin.left - margin.right;
  const height = outerH - margin.top - margin.bottom;

  const svgRoot = d3
    .select("#ldaPlot")
    .attr("width", outerW)
    .attr("height", outerH)
    .attr("viewBox", `0 0 ${outerW} ${outerH}`)
    .style("max-width", "100%")
    .style("height", "auto");

  svgRoot.selectAll("g").remove();

  svgRoot
    .append("text")
    .attr("x", outerW / 2)
    .attr("y", margin.top / 2 + 5)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-weight", "bold")
    .text("LDA Projection of Selected Board Game Categories");

  const svg = svgRoot
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const xExtent = d3.extent(projected, (d) => d[0]);
  const yExtent = d3.extent(projected, (d) => d[1]);
  const xPad = (xExtent[1] - xExtent[0]) * 0.1;
  const yPad = (yExtent[1] - yExtent[0]) * 0.1;

  const x = d3
    .scaleLinear()
    .domain([xExtent[0] - xPad, xExtent[1] + xPad])
    .nice()
    .range([0, width]);

  const y = d3
    .scaleLinear()
    .domain([yExtent[0] - yPad, yExtent[1] + yPad])
    .nice()
    .range([height, 0]);

  svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
  svg.append("g").call(d3.axisLeft(y));

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height + 30)
    .attr("text-anchor", "middle")
    .text("LD‑1");

  svg
    .append("text")
    .attr("x", -height / 2)
    .attr("y", -35)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("LD‑2");

  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "#fff")
    .style("border", "1px solid #ccc")
    .style("padding", "10px")
    .style("pointer-events", "none")
    .style("opacity", 0);

  svg
    .selectAll("circle")
    .data(projected.map((coords, i) => ({ coords, index: i })))
    .enter()
    .append("circle")
    .attr("cx", d => x(d.coords[0]))
    .attr("cy", d => y(d.coords[1]))
    .attr("r", 5)
    .attr("fill", d => ldaCategoryColorMap.get(labelNames[d.index]) || "#ccc")
    .attr("stroke", "#333")
    .on("mouseover", (event, d) => {
      const g = games[d.index];
      const rating = g.rating?.rating?.toFixed(2) ?? "N/A";
      const reviews = g.rating?.num_of_reviews ?? "N/A";
      const players = `${g.minplayers ?? "?"} – ${g.maxplayers ?? "?"}`;
      const playtime = `${g.minplaytime ?? "?"} – ${g.maxplaytime ?? "?"} min`;
      const age = `${g.minage ?? "?"}+`;
      const matchingCats = (g.types?.categories ?? [])
        .map((c) => c.name)
        .filter((name) => selectedCategories.includes(name))
        .join(", ") || "None";

      ldaTooltip
        .style("opacity", 1)
        .html(
          `<strong>${labelNames[d.index]}</strong><br/>
          Game name: <strong>${g.title}</strong><br/>
          ⭐ Rating: ${rating} (${reviews} reviews)<br/>
          👥 Players: ${players}<br/>
          ⏱️ Playtime: ${playtime}<br/>
          🎯 Min Age: ${age}<br/>
          🏷️ Categories: ${matchingCats}`
        );
    })
    .on("mousemove", (event) => {
      ldaTooltip
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", () => {
      ldaTooltip.style("opacity", 0);
    });

  const legend = svg
    .append("g")
    .attr("transform", `translate(${width + 20}, 10)`);

  legend
    .selectAll("rect")
    .data(selectedCategories)
    .enter()
    .append("rect")
    .attr("y", (_, i) => i * 20)
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", (d) => ldaCategoryColorMap.get(d) || "#ccc")

  legend
    .selectAll("text")
    .data(selectedCategories)
    .enter()
    .append("text")
    .attr("x", 18)
    .attr("y", (_, i) => i * 20 + 10)
    .attr("alignment-baseline", "middle")
    .text((d) => d);
}

// Load data and set up interaction
fetch("../boardgames_40.json")
  .then((res) => res.json())
  .then((rawData) => {
    ldaRawData = rawData;

    document.querySelectorAll('#category-controls input[type="checkbox"]').forEach(cb => {
      cb.addEventListener("change", () => {
        updateLDAPlot(getSelectedCategories());
      });
    });

    updateLDAPlot(getSelectedCategories());
  });

