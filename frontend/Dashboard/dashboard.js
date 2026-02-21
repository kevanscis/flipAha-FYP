const API_BASE_URL = 'http://localhost:5000';

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Active Users (Basic)
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function loadActiveUsers() {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/active-users`, {
    credentials: 'include'
  });

  const data = await res.json();

  // Update KPI numbers
  document.getElementById('dailyCount').textContent = data.daily;
  document.getElementById('weeklyCount').textContent = data.weekly;
  document.getElementById('monthlyCount').textContent = data.monthly;
  document.getElementById('inactiveCount').textContent = data.inactive;

  const values = [
    { label: 'Daily', value: data.daily },
    { label: 'Weekly', value: data.weekly },
    { label: 'Monthly', value: data.monthly },
    { label: 'Inactive', value: data.inactive },
  ];
}

// Basic bar chart version (replaced by line chart with granularity buttons)
// function renderActiveUsersChart(values) {
//     const width = 500;
//     const height = 250;
//     const margin = { top: 30, right: 20, bottom: 50, left: 50 };

//     const svg = d3.select('#activeUsersChart')
//         .attr('width', width)
//         .attr('height', height);

//     svg.selectAll('*').remove(); // clear redraw

//     const x = d3.scaleBand()
//         .domain(values.map(d => d.label))
//         .range([margin.left, width - margin.right])
//         .padding(0.3);

//     const y = d3.scaleLinear()
//         .domain([0, d3.max(values, d => d.value) || 1])
//         .nice()
//         .range([height - margin.bottom, margin.top]);

//     svg.append('g')
//         .attr('transform', `translate(0,${height - margin.bottom})`)
//         .call(d3.axisBottom(x));

//     svg.append('g')
//         .attr('transform', `translate(${margin.left},0)`)
//         .call(d3.axisLeft(y));

//     svg.selectAll('rect')
//         .data(values)
//         .enter()
//         .append('rect')
//         .attr('x', d => x(d.label))
//         .attr('y', d => y(d.value))
//         .attr('height', d => y(0) - y(d.value))
//         .attr('width', x.bandwidth())
//         .attr('fill', '#0d6efd');
// }

loadActiveUsers();

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Active Users Trend (Daily/Weekly/Monthly)
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function loadActiveTrend(granularity) {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/active-trend?granularity=${granularity}`, {
    credentials: 'include'
  });
  const data = await res.json();
  renderActiveTrendLine(data, granularity);
}

document.getElementById("btnDaily").addEventListener("click", () => loadActiveTrend("daily"));
document.getElementById("btnWeekly").addEventListener("click", () => loadActiveTrend("weekly"));
document.getElementById("btnMonthly").addEventListener("click", () => loadActiveTrend("monthly"));
document.getElementById("btnInactive").addEventListener("click", () => loadActiveTrend("inactive"));

function renderActiveTrendLine(data, granularity) {
    const width = 500;
    const height = 350;
    const margin = { top: 30, right: 30, bottom: 50, left: 50 };

    const svg = d3.select('#activeTrendChart')
        .attr('width', width)
        .attr('height', height);

    svg.selectAll('*').remove();

    data.forEach(d => {
        d.count = +d.count;
    });

    // X scale (categorical for weekly/monthly, time for daily)
    let x;

    if (granularity === "daily") {
        const parseDate = d3.timeParse("%Y-%m-%d");
        data.forEach(d => d.date = parseDate(d.label));

        x = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([margin.left, width - margin.right]);
    } else {
        x = d3.scalePoint()
        .domain(data.map(d => d.label))
        .range([margin.left, width - margin.right]);
    }

    const maxValue = d3.max(data, d => d.count);

    const y = d3.scaleLinear()
        .domain([0, maxValue])
        .nice()
        .range([height - margin.bottom, margin.top]);

    const tickDates = data.map(d => d.date);
    
    // Axes
    if (granularity === "daily") {
        svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(
            d3.axisBottom(x)
            .tickValues(tickDates)
            .tickFormat(d3.timeFormat('%a %d %b %Y'))
        );
        svg.selectAll(".tick text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");

    } else {
        svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x));
    }

    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(
            d3.axisLeft(y)
            .ticks(maxValue)           // force whole number ticks
            .tickFormat(d3.format('d')) // remove decimals
        );

    // Line generator
    const line = d3.line()
        .x(d => granularity === "daily" ? x(d.date) : x(d.label))
        .y(d => y(d.count));

    svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#0d6efd')
        .attr('stroke-width', 2)
        .attr('d', line);

    // Points
    svg.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
        .attr('cx', d => granularity === "daily" ? x(d.date) : x(d.label))
        .attr('cy', d => y(d.count))
        .attr('r', 4)
        .attr('fill', '#0d6efd');
}

// default load
loadActiveTrend("daily");

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// New vs Returning Users
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function loadNewReturningUsers() {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/new-returning`, {
        credentials: 'include'
    });
    const data = await res.json();

    const values = [
        { label: 'New', value: data.new_active },
        { label: 'Returning', value: data.returning_active },
    ];

    renderNewReturningChart(values);
}

function renderNewReturningChart(values) {
    const width = 500;
    const height = 350;
    const margin = { top: 30, right: 30, bottom: 50, left: 50 };

    const svg = d3.select('#newReturningChart')
        .attr('width', width)
        .attr('height', height);

    svg.selectAll('*').remove();

    const x = d3.scaleBand()
        .domain(values.map(d => d.label))
        .range([margin.left, width - margin.right])
        .padding(0.3);

    const y = d3.scaleLinear()
        .domain([0, d3.max(values, d => d.value) || 1])
        .nice()
        .range([height - margin.bottom, margin.top]);

    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x));

    const yMax = Math.ceil(d3.max(values, d => d.value) || 1);

    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(
            d3.axisLeft(y)
            .tickValues(d3.range(0, yMax + 1, 1))  // 0,1,2,3...
            .tickFormat(d3.format('d'))
        );

    svg.selectAll('rect')
        .data(values)
        .enter()
        .append('rect')
        .attr('x', d => x(d.label))
        .attr('y', d => y(d.value))
        .attr('height', d => y(0) - y(d.value))
        .attr('width', x.bandwidth());
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Question Volume Over Time
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function loadQuestionVolume() {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/question-volume`, {
        credentials: 'include'
    });
    const data = await res.json();

    renderQuestionVolumeChart(data);
}
function renderQuestionVolumeChart(data) {
    const width = 500;
    const height = 250;
    const margin = { top: 30, right: 30, bottom: 50, left: 50 };

    const svg = d3.select('#questionVolumeChart')
        .attr('width', width)
        .attr('height', height);

    svg.selectAll('*').remove();

    const parseDate = d3.timeParse('%Y-%m-%d');

    data.forEach(d => {
        d.date = parseDate(d.day);
        d.count = +d.count;
    });

    const x = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count) || 1])
        .nice()
        .range([height - margin.bottom, margin.top]);

    const line = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.count));

    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(7).tickFormat(d3.timeFormat('%a')));

    const yMax = Math.ceil(d3.max(data, d => d.count) || 1);

    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(
            d3.axisLeft(y)
            .tickValues(d3.range(0, yMax + 1, 1))
            .tickFormat(d3.format('d'))
        );


    svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#0d6efd')
        .attr('stroke-width', 2)
        .attr('d', line);

    // Points
    svg.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
        .attr('cx', d => x(d.date))
        .attr('cy', d => y(d.count))
        .attr('r', 4)
        .attr('fill', '#0d6efd');
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Input Method Trends
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function loadInputMethodTrends() {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/input-method-trends`, {
        credentials: 'include'
    });
    const data = await res.json();

    renderInputMethodTrendChart(data);
}

function renderInputMethodTrendChart(data) {
    const width = 500;
    const height = 250;
    const margin = { top: 30, right: 80, bottom: 50, left: 50 };

    const svg = d3.select('#inputMethodTrendChart')
        .attr('width', width)
        .attr('height', height);

    svg.selectAll('*').remove();

    const parseDate = d3.timeParse('%Y-%m-%d');

    data.forEach(d => {
        d.date = parseDate(d.day);
        d.typing = +d.typing;
        d.suggestion = +d.suggestion;
    });

    const x = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([margin.left, width - margin.right]);

    const yMax = d3.max(data, d => Math.max(d.typing, d.suggestion)) || 1;
    const y = d3.scaleLinear()
        .domain([0, yMax])
        .nice()
        .range([height - margin.bottom, margin.top]);

    // Axes
    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(7).tickFormat(d3.timeFormat('%a')));

    const yMaxInt = Math.ceil(yMax || 1);

    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(
            d3.axisLeft(y)
            .tickValues(d3.range(0, yMaxInt + 1, 1))
            .tickFormat(d3.format('d'))
        );


    // Line generators
    const lineTyping = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.typing));

    const lineSuggestion = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.suggestion));

    // Draw lines (use different strokes)
    svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#0d6efd')  // typing
        .attr('stroke-width', 2)
        .attr('d', lineTyping);

    svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#198754')  // suggestion
        .attr('stroke-width', 2)
        .attr('d', lineSuggestion);

    // Optional: points
    svg.selectAll('.pt-typing')
        .data(data)
        .enter()
        .append('circle')
        .attr('class', 'pt-typing')
        .attr('cx', d => x(d.date))
        .attr('cy', d => y(d.typing))
        .attr('r', 3)
        .attr('fill', '#0d6efd');

    svg.selectAll('.pt-suggestion')
        .data(data)
        .enter()
        .append('circle')
        .attr('class', 'pt-suggestion')
        .attr('cx', d => x(d.date))
        .attr('cy', d => y(d.suggestion))
        .attr('r', 3)
        .attr('fill', '#198754');

    // Legend (simple)
    const legendX = width - margin.right + 10;
    const legendY = margin.top;

    svg.append('circle').attr('cx', legendX).attr('cy', legendY).attr('r', 5).attr('fill', '#0d6efd');
    svg.append('text').attr('x', legendX + 10).attr('y', legendY + 4).text('Typing').style('font-size', '12px');

    svg.append('circle').attr('cx', legendX).attr('cy', legendY + 20).attr('r', 5).attr('fill', '#198754');
    svg.append('text').attr('x', legendX + 10).attr('y', legendY + 24).text('Suggestion').style('font-size', '12px');
}

// Navigation functions
function goHome() {
  window.location.href = '../index.html';
}

function goLogout() {
  window.location.href = '../Login and Register/login.html';
}

loadNewReturningUsers();
loadQuestionVolume();
loadInputMethodTrends();

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Suggestion Feedback (Total + Top Suggestions)
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function loadSuggestionFeedback() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/dashboard/suggestion-feedback`, {
            credentials: 'include'
        });
        if (!res.ok) {
            console.warn('Failed to load suggestion feedback', res.status);
            return;
        }

        const data = await res.json();
        renderSuggestionFeedback(data);
    } catch (e) {
        console.error('Error loading suggestion feedback', e);
    }
}

function renderSuggestionFeedback(data) {
    const total = data.total || 0;
    const useful = data.useful || 0;
    const notUseful = data.not_useful || (total - useful);
    const rate = total > 0 ? Math.round((useful / total) * 100) : 0;

    document.getElementById('sfTotal').textContent = total;
    document.getElementById('sfUseful').textContent = useful;
    document.getElementById('sfNotUseful').textContent = notUseful;
    document.getElementById('sfRate').textContent = rate + '%';
}

// load suggestion feedback after other data
loadSuggestionFeedback();