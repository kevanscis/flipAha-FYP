const API_BASE_URL = 'http://localhost:5000';

function goHome(){
  window.location.href = `${API_BASE_URL}/`;
}

function goLogout() {
  window.location.href = `${API_BASE_URL}/login`;
}

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

// Helper function to update active button state
function setActiveButton(buttonId) {
  const allButtons = document.querySelectorAll('.chart-controls .btn-control');
  allButtons.forEach(btn => btn.classList.remove('active-btn'));
  document.getElementById(buttonId).classList.add('active-btn');
}

document.getElementById("btnDaily").addEventListener("click", () => {
  setActiveButton("btnDaily");
  loadActiveTrend("daily");
});
document.getElementById("btnWeekly").addEventListener("click", () => {
  setActiveButton("btnWeekly");
  loadActiveTrend("weekly");
});
document.getElementById("btnMonthly").addEventListener("click", () => {
  setActiveButton("btnMonthly");
  loadActiveTrend("monthly");
});
document.getElementById("btnInactive").addEventListener("click", () => {
  setActiveButton("btnInactive");
  loadActiveTrend("inactive");
});

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
    const height = 350;
    const radius = Math.min(width, height) / 2 - 50;

    const svg = d3.select('#inputMethodTrendChart')
        .attr('width', width)
        .attr('height', height);

    svg.selectAll('*').remove();

    // Calculate totals for each input method
    let typingTotal = 0;
    let suggestionTotal = 0;
    let imageTotal = 0;

    data.forEach(d => {
        typingTotal += +d.typing;
        suggestionTotal += +d.suggestion;
        imageTotal += +d.image;
    });

    const pieData = [
        { label: 'Typing', value: typingTotal },
        { label: 'Suggestion', value: suggestionTotal },
        { label: 'Image', value: imageTotal }
    ];

    const colors = {
        'Typing': '#0d6efd',
        'Suggestion': '#198754',
        'Image': '#fd7e14'
    };

    const g = svg.append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

    const pie = d3.pie().value(d => d.value);
    const arc = d3.arc().innerRadius(0).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(0).outerRadius(radius + 10);

    const slices = g.selectAll('.slice')
        .data(pie(pieData))
        .enter()
        .append('g')
        .attr('class', 'slice');

    slices.append('path')
        .attr('d', arc)
        .attr('fill', d => colors[d.data.label])
        .attr('opacity', 0.85)
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .on('mouseover', function() {
            d3.select(this).attr('opacity', 1).attr('d', arcHover);
        })
        .on('mouseout', function() {
            d3.select(this).attr('opacity', 0.85).attr('d', arc);
        });

    // Labels on the pie
    slices.append('text')
        .attr('transform', d => `translate(${arc.centroid(d)})`)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('fill', 'white')
        .text(d => {
            const total = d3.sum(pieData, p => p.value);
            const percent = ((d.data.value / total) * 100).toFixed(0);
            return percent + '%';
        });

    // Legend - Top right
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width - 140}, 20)`);

    pieData.forEach((d, i) => {
        const legendRow = legend.append('g')
            .attr('transform', `translate(0, ${i * 25})`);

        legendRow.append('rect')
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', colors[d.label]);

        legendRow.append('text')
            .attr('x', 18)
            .attr('y', 10)
            .style('font-size', '12px')
            .text(`${d.label} (${d.value})`);
    });
}

loadNewReturningUsers();
loadQuestionVolume();
loadInputMethodTrends();
loadTopicDistribution();

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Topic Distribution Chart
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function loadTopicDistribution() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/dashboard/topic-frequency`, {
            credentials: 'include'
        });
        if (!res.ok) {
            console.warn('Failed to load topic distribution', res.status);
            return;
        }

        const data = await res.json();
        renderTopicDistribution(data);
    } catch (e) {
        console.error('Error loading topic distribution', e);
    }
}

function renderTopicDistribution(data) {
    const width = 500;
    const height = 350;
    const margin = { top: 30, right: 30, bottom: 100, left: 50 };

    const svg = d3.select('#topicDistributionChart')
        .attr('width', width)
        .attr('height', height);

    svg.selectAll('*').remove();

    // Parse count as number
    data.forEach(d => {
        d.count = +d.count;
    });

    // Create scales
    const x = d3.scaleBand()
        .domain(data.map(d => d.topic))
        .range([margin.left, width - margin.right])
        .padding(0.3);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count) || 1])
        .nice()
        .range([height - margin.bottom, margin.top]);

    // Color scale
    const colors = ['#0d6efd', '#198754', '#fd7e14', '#dc3545', '#6f42c1', '#20c997'];
    const colorScale = d3.scaleOrdinal()
        .domain(data.map(d => d.topic))
        .range(colors.concat(d3.schemeCategory10));

    // X axis
    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x))
        .append('text')
        .attr('x', (width - margin.left - margin.right) / 2 + margin.left)
        .attr('y', 40)
        .attr('fill', 'black')
        .attr('text-anchor', 'middle')
        .text('Topic');

    // Y axis
    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y))
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (height - margin.top - margin.bottom) / 2)
        .attr('dy', '1em')
        .attr('fill', 'black')
        .attr('text-anchor', 'middle')
        .text('Count');

    // Bars
    svg.selectAll('.topic-bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'topic-bar')
        .attr('x', d => x(d.topic))
        .attr('y', d => y(d.count))
        .attr('width', x.bandwidth())
        .attr('height', d => height - margin.bottom - y(d.count))
        .attr('fill', d => colorScale(d.topic))
        .attr('opacity', 0.85)
        .on('mouseover', function() {
            d3.select(this).attr('opacity', 1);
        })
        .on('mouseout', function() {
            d3.select(this).attr('opacity', 0.85);
        });

    // Value labels on bars
    svg.selectAll('.topic-label')
        .data(data)
        .enter()
        .append('text')
        .attr('class', 'topic-label')
        .attr('x', d => x(d.topic) + x.bandwidth() / 2)
        .attr('y', d => y(d.count) - 5)
        .attr('text-anchor', 'middle')
        .attr('fill', 'black')
        .attr('font-weight', 'bold')
        .attr('font-size', '12px')
        .text(d => d.count);

    // Rotate x-axis labels
    svg.selectAll('.domain, .tick line')
        .style('stroke', '#ccc');

    svg.selectAll('.tick text')
        .style('font-size', '11px')
        .attr('transform', 'rotate(45)')
        .attr('text-anchor', 'start');
}

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

    // Determine emoji and color based on rate
    let emoji, sentiment, color;
    
    if (rate < 20) {
        emoji = '😠';
        sentiment = 'Poor';
        color = '#dc3545';
    } else if (rate < 40) {
        emoji = '😕';
        sentiment = 'Fair';
        color = '#fd7e14';
    } else if (rate < 60) {
        emoji = '😐';
        sentiment = 'Neutral';
        color = '#ffc107';
    } else if (rate < 80) {
        emoji = '🙂';
        sentiment = 'Good';
        color = '#17a2b8';
    } else {
        emoji = '😄';
        sentiment = 'Excellent';
        color = '#198754';
    }

    // Update the emoji display
    const feedbackEmoji = document.getElementById('sfEmoji');
    if (feedbackEmoji) {
        feedbackEmoji.textContent = emoji;
        feedbackEmoji.style.fontSize = '72px';
        feedbackEmoji.style.margin = '20px 0';
    }

    // Update sentiment text
    const feedbackSentiment = document.getElementById('sfSentiment');
    if (feedbackSentiment) {
        feedbackSentiment.textContent = sentiment;
        feedbackSentiment.style.fontSize = '18px';
        feedbackSentiment.style.fontWeight = 'bold';
        feedbackSentiment.style.color = color;
        feedbackSentiment.style.margin = '10px 0';
    }

    // Update rate with color
    const feedbackRate = document.getElementById('sfRate');
    if (feedbackRate) {
        feedbackRate.textContent = rate + '%';
        feedbackRate.style.fontSize = '28px';
        feedbackRate.style.fontWeight = 'bold';
        feedbackRate.style.color = color;
    }

    // Update numbers
    document.getElementById('sfTotal').textContent = total;
    document.getElementById('sfUseful').textContent = useful;
    document.getElementById('sfNotUseful').textContent = notUseful;

    // Optional: add a progress bar background
    const feedbackContainer = document.querySelector('[id*="sfContainer"], .suggestion-feedback');
    if (feedbackContainer) {
        feedbackContainer.style.background = `linear-gradient(90deg, ${color}15 0%, ${color}15 ${rate}%, transparent ${rate}%, transparent 100%)`;
    }
}

// load suggestion feedback after other data
loadSuggestionFeedback();