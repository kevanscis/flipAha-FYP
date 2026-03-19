const API_BASE_URL = ''; // Relative — works in both dev and production
const CHART_WIDTH = 500;
const CHART_HEIGHT = 320;
const dashboardDateFilter = {
    startDate: '',
    endDate: ''
};
const dashboardState = {
    difficultyData: [],
    selectedTopic: null,
    difficultySortKey: 'hard_pct',
    difficultySortDir: 'desc',
    difficultySeries: {
        easy_count: true,
        medium_count: true,
        hard_count: true
    }
};

const chartHelpText = {
    difficultyByTopicChart: 'Shows easy, medium, and hard question counts by topic.',
    topicDistributionChart: 'Shows total question volume split by topic.',
    questionVolumeChart: 'Shows day-by-day number of submitted questions for selected range.',
    activeTrendChart: 'Shows active user trend by selected granularity.',
    newReturningChart: 'Shows ratio of new active users versus returning users.',
    inputMethodTrendChart: 'Shows typing, suggestion, and image usage volumes.'
};

function toDateParams(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    return params.toString();
}

function setupResponsiveSvg(selector, width, height) {
    return d3.select(selector)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('width', width)
        .attr('height', height)
        .style('width', '100%')
        .style('height', 'auto')
        .style('display', 'block');
}

function setChartLoading(chartId, loading) {
    const svg = document.getElementById(chartId);
    if (!svg) return;
    const card = svg.closest('.chart-card');
    if (!card) return;

    let overlay = card.querySelector('.chart-loading');
    if (loading) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'chart-loading';
            overlay.textContent = 'Loading...';
            card.appendChild(overlay);
        }
    } else if (overlay) {
        overlay.remove();
    }
}

function formatDateValue(d) {
    return d.toISOString().slice(0, 10);
}

function setLastUpdated() {
    const el = document.getElementById('dashboardLastUpdated');
    if (!el) return;
    const now = new Date();
    el.textContent = `Last updated: ${now.toLocaleString()}`;
}

function saveFilterState() {
    localStorage.setItem('dashboard_date_filter', JSON.stringify(dashboardDateFilter));
}

function loadFilterState() {
    try {
        const raw = localStorage.getItem('dashboard_date_filter');
        if (!raw) return;
        const saved = JSON.parse(raw);
        dashboardDateFilter.startDate = saved.startDate || '';
        dashboardDateFilter.endDate = saved.endDate || '';
    } catch (_) {
        // Ignore malformed saved filter state.
    }
}

function applyFilterInputs() {
    const startInput = document.getElementById('globalStartDate');
    const endInput = document.getElementById('globalEndDate');
    if (startInput) startInput.value = dashboardDateFilter.startDate;
    if (endInput) endInput.value = dashboardDateFilter.endDate;
}

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
    setChartLoading('activeTrendChart', true);
    try {
        const res = await fetch(`${API_BASE_URL}/api/dashboard/active-trend?granularity=${granularity}`, {
            credentials: 'include'
        });
        const data = await res.json();
        renderActiveTrendLine(data, granularity);
    } finally {
        setChartLoading('activeTrendChart', false);
    }
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
    const width = CHART_WIDTH;
    const height = CHART_HEIGHT;
    const margin = { top: 30, right: 30, bottom: 50, left: 50 };

    const svg = setupResponsiveSvg('#activeTrendChart', width, height);

    svg.selectAll('*').remove();

    const rows = Array.isArray(data) ? data : [];

    rows.forEach(d => {
        d.count = +d.count;
    });

    if (!rows.length || rows.every(d => d.count === 0)) {
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('class', 'no-data-label')
            .text('No active-user data available');
        return;
    }

    // X scale (categorical for weekly/monthly, time for daily)
    let x;

    if (granularity === "daily") {
        const parseDate = d3.timeParse("%Y-%m-%d");
        rows.forEach(d => d.date = parseDate(d.label));

        x = d3.scaleTime()
        .domain(d3.extent(rows, d => d.date))
        .range([margin.left, width - margin.right]);
    } else {
        x = d3.scalePoint()
        .domain(rows.map(d => d.label))
        .range([margin.left, width - margin.right]);
    }

    const maxValue = d3.max(rows, d => d.count);

    const y = d3.scaleLinear()
        .domain([0, maxValue])
        .nice()
        .range([height - margin.bottom, margin.top]);

    const tickDates = rows.map(d => d.date);
    
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

    // Add gradient definition
    svg.append('defs').append('linearGradient')
        .attr('id', 'gradientActiveTrend')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%')
        .selectAll('stop')
        .data([{ offset: '0%', color: '#0d6efd' }, { offset: '100%', color: '#0d6efd00' }])
        .enter()
        .append('stop')
        .attr('offset', d => d.offset)
        .attr('stop-color', d => d.color);

    // Line generator with smooth curve
    const line = d3.line()
        .curve(d3.curveMonotoneX)
        .x(d => granularity === "daily" ? x(d.date) : x(d.label))
        .y(d => y(d.count));

    // Area for gradient fill
    const area = d3.area()
        .curve(d3.curveMonotoneX)
        .x(d => granularity === "daily" ? x(d.date) : x(d.label))
        .y0(height - margin.bottom)
        .y1(d => y(d.count));

    svg.append('path')
        .datum(rows)
        .attr('fill', 'url(#gradientActiveTrend)')
        .attr('d', area);

    svg.append('path')
        .datum(rows)
        .attr('fill', 'none')
        .attr('stroke', '#0d6efd')
        .attr('stroke-width', 2.5)
        .attr('d', line);

    // Hover tooltip
    const tooltip = svg.append('g')
        .attr('class', 'tooltip')
        .style('display', 'none');

    tooltip.append('line')
        .attr('class', 'tooltip-line')
        .attr('stroke', '#999')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4');

    tooltip.append('circle')
        .attr('class', 'tooltip-dot')
        .attr('r', 5)
        .attr('fill', '#0d6efd');

    tooltip.append('text')
        .attr('class', 'tooltip-text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-10')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', '#0d6efd')
        .style('background', 'white')
        .style('padding', '4px 8px');

    // Mousemove handler
    const handleMouseMove = function(event) {
        const [mouseX] = d3.pointer(event);
        let closestData = null;
        let closestDistance = Infinity;

        rows.forEach(d => {
            const pointX = granularity === "daily" ? x(d.date) : x(d.label);
            const distance = Math.abs(pointX - mouseX);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestData = d;
            }
        });

        if (closestDistance < 30) {
            const pointX = granularity === "daily" ? x(closestData.date) : x(closestData.label);
            const pointY = y(closestData.count);

            tooltip.style('display', null);
            tooltip.select('.tooltip-line')
                .attr('x1', pointX)
                .attr('y1', margin.top)
                .attr('x2', pointX)
                .attr('y2', height - margin.bottom);

            tooltip.select('.tooltip-dot')
                .attr('cx', pointX)
                .attr('cy', pointY);

            tooltip.select('.tooltip-text')
                .attr('x', pointX)
                .attr('y', pointY)
                .text(closestData.count);
        } else {
            tooltip.style('display', 'none');
        }
    };

    svg.on('mousemove', handleMouseMove)
        .on('mouseleave', () => tooltip.style('display', 'none'));
}

// default load
loadActiveTrend("daily");

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// New vs Returning Users
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function loadNewReturningUsers() {
    setChartLoading('newReturningChart', true);
    try {
        const res = await fetch(`${API_BASE_URL}/api/dashboard/new-returning`, {
            credentials: 'include'
        });
        const data = await res.json();

        const values = [
            { label: 'New', value: data.new_active },
            { label: 'Returning', value: data.returning_active },
        ];

        renderNewReturningChart(values);
    } finally {
        setChartLoading('newReturningChart', false);
    }
}

function renderNewReturningChart(values) {
    const width = CHART_WIDTH;
    const height = CHART_HEIGHT;
    const radius = Math.min(width, height) / 2 - 50;

    const svg = setupResponsiveSvg('#newReturningChart', width, height);

    svg.selectAll('*').remove();

    const totalValue = values.reduce((acc, v) => acc + Number(v.value || 0), 0);
    if (totalValue === 0) {
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('class', 'no-data-label')
            .text('No new/returning user data available');
        return;
    }

    const colors = {
        'New': '#0072B2',
        'Returning': '#009E73'
    };

    const g = svg.append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

    const pie = d3.pie().value(d => d.value);
    const arc = d3.arc().innerRadius(radius * 0.5).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(radius * 0.5).outerRadius(radius + 10);

    const slices = g.selectAll('.slice')
        .data(pie(values))
        .enter()
        .append('g')
        .attr('class', 'slice');

    slices.append('path')
        .attr('d', arc)
        .attr('fill', d => colors[d.data.label])
        .attr('opacity', 0.85)
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function() {
            d3.select(this).attr('opacity', 1).attr('d', arcHover);
        })
        .on('mouseout', function() {
            d3.select(this).attr('opacity', 0.85).attr('d', arc);
        });

    // Labels on the donut
    slices.append('text')
        .attr('transform', d => `translate(${arc.centroid(d)})`)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '16px')
        .attr('font-weight', 'bold')
        .attr('fill', 'white')
        .text(d => {
            const total = d3.sum(values, p => p.value);
            const percent = ((d.data.value / total) * 100).toFixed(0);
            return percent + '%';
        });

    // Legend - Bottom center
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width / 2 - 100}, ${height - 40})`);

    values.forEach((d, i) => {
        const legendRow = legend.append('g')
            .attr('transform', `translate(${i * 200}, 0)`);

        legendRow.append('rect')
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', colors[d.label]);

        legendRow.append('text')
            .attr('x', 18)
            .attr('y', 10)
            .style('font-size', '13px')
            .style('font-weight', 'bold')
            .text(`${d.label} (${d.value})`);
    });
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Question Volume Over Time
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function loadQuestionVolume(startDate = '', endDate = '') {
    setChartLoading('questionVolumeChart', true);
    const qs = toDateParams(startDate, endDate);
    const url = `${API_BASE_URL}/api/dashboard/question-volume${qs ? `?${qs}` : ''}`;
    try {
        const res = await fetch(url, {
            credentials: 'include'
        });
        const data = await res.json();
        renderQuestionVolumeChart(data);
        return data;
    } finally {
        setChartLoading('questionVolumeChart', false);
    }
}
function renderQuestionVolumeChart(data) {
    const width = CHART_WIDTH;
    const height = CHART_HEIGHT;
    const margin = { top: 30, right: 30, bottom: 50, left: 50 };

    const svg = setupResponsiveSvg('#questionVolumeChart', width, height);

    svg.selectAll('*').remove();

    const parseDate = d3.timeParse('%Y-%m-%d');

    const rows = Array.isArray(data) ? data : [];

    rows.forEach(d => {
        d.date = parseDate(d.day);
        d.count = +d.count;
    });

    if (!rows.length || rows.every(d => d.count === 0)) {
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('class', 'no-data-label')
            .text('No question volume data in selected range');
        return;
    }

    const x = d3.scaleTime()
        .domain(d3.extent(rows, d => d.date))
        .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(rows, d => d.count) || 1])
        .nice()
        .range([height - margin.bottom, margin.top]);

    // Add gradient definition
    svg.append('defs').append('linearGradient')
        .attr('id', 'gradientQuestionVolume')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%')
        .selectAll('stop')
        .data([{ offset: '0%', color: '#0d6efd' }, { offset: '100%', color: '#0d6efd00' }])
        .enter()
        .append('stop')
        .attr('offset', d => d.offset)
        .attr('stop-color', d => d.color);

    const line = d3.line()
        .curve(d3.curveMonotoneX)
        .x(d => x(d.date))
        .y(d => y(d.count));

    // Area for gradient fill
    const area = d3.area()
        .curve(d3.curveMonotoneX)
        .x(d => x(d.date))
        .y0(height - margin.bottom)
        .y1(d => y(d.count));

    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(7).tickFormat(d3.timeFormat('%a')));

    const yMax = Math.ceil(d3.max(rows, d => d.count) || 1);

    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(
            d3.axisLeft(y)
            .tickValues(d3.range(0, yMax + 1, 1))
            .tickFormat(d3.format('d'))
        );

    svg.append('path')
        .datum(rows)
        .attr('fill', 'url(#gradientQuestionVolume)')
        .attr('d', area);

    svg.append('path')
        .datum(rows)
        .attr('fill', 'none')
        .attr('stroke', '#0d6efd')
        .attr('stroke-width', 2.5)
        .attr('d', line);

    // Hover tooltip
    const tooltip = svg.append('g')
        .attr('class', 'tooltip')
        .style('display', 'none');

    tooltip.append('line')
        .attr('class', 'tooltip-line')
        .attr('stroke', '#999')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4');

    tooltip.append('circle')
        .attr('class', 'tooltip-dot')
        .attr('r', 5)
        .attr('fill', '#0d6efd');

    tooltip.append('text')
        .attr('class', 'tooltip-text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-10')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', '#0d6efd');

    // Mousemove handler
    const handleMouseMove = function(event) {
        const [mouseX] = d3.pointer(event);
        let closestData = null;
        let closestDistance = Infinity;

        rows.forEach(d => {
            const pointX = x(d.date);
            const distance = Math.abs(pointX - mouseX);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestData = d;
            }
        });

        if (closestDistance < 30) {
            const pointX = x(closestData.date);
            const pointY = y(closestData.count);

            tooltip.style('display', null);
            tooltip.select('.tooltip-line')
                .attr('x1', pointX)
                .attr('y1', margin.top)
                .attr('x2', pointX)
                .attr('y2', height - margin.bottom);

            tooltip.select('.tooltip-dot')
                .attr('cx', pointX)
                .attr('cy', pointY);

            tooltip.select('.tooltip-text')
                .attr('x', pointX)
                .attr('y', pointY)
                .text(closestData.count);
        } else {
            tooltip.style('display', 'none');
        }
    };

    svg.on('mousemove', handleMouseMove)
        .on('mouseleave', () => tooltip.style('display', 'none'));
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Input Method Trends
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function loadInputMethodTrends(startDate = '', endDate = '') {
    setChartLoading('inputMethodTrendChart', true);
    const qs = toDateParams(startDate, endDate);
    const url = `${API_BASE_URL}/api/dashboard/input-method-trends${qs ? `?${qs}` : ''}`;
    try {
        const res = await fetch(url, {
            credentials: 'include'
        });
        const data = await res.json();
        renderInputMethodTrendChart(data);
        return data;
    } finally {
        setChartLoading('inputMethodTrendChart', false);
    }
}

function renderInputMethodTrendChart(data) {
    const width = CHART_WIDTH;
    const height = CHART_HEIGHT;
    const radius = Math.min(width, height) / 2 - 50;

    const svg = setupResponsiveSvg('#inputMethodTrendChart', width, height);

    svg.selectAll('*').remove();

    // Calculate totals for each input method
    let typingTotal = 0;
    let suggestionTotal = 0;
    let imageTotal = 0;

    const rows = Array.isArray(data) ? data : [];

    rows.forEach(d => {
        typingTotal += +d.typing;
        suggestionTotal += +d.suggestion;
        imageTotal += +d.image;
    });

    const grandTotal = typingTotal + suggestionTotal + imageTotal;
    if (!rows.length || grandTotal === 0) {
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('class', 'no-data-label')
            .text('No input-method data in selected range');
        return;
    }

    const pieData = [
        { label: 'Typing', value: typingTotal },
        { label: 'Suggestion', value: suggestionTotal },
        { label: 'Image', value: imageTotal }
    ];

    const colors = {
        'Typing': '#0072B2',
        'Suggestion': '#009E73',
        'Image': '#D55E00'
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

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Topic Distribution Chart
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function loadTopicDistribution(startDate = '', endDate = '') {
    try {
        setChartLoading('topicDistributionChart', true);
        const qs = toDateParams(startDate, endDate);
        const url = `${API_BASE_URL}/api/dashboard/topic-frequency${qs ? `?${qs}` : ''}`;

        const res = await fetch(url, {
            credentials: 'include'
        });
        if (!res.ok) {
            console.warn('Failed to load topic distribution', res.status);
            return;
        }

        const data = await res.json();
        renderTopicDistribution(data);
        return data;
    } catch (e) {
        console.error('Error loading topic distribution', e);
        return [];
    } finally {
        setChartLoading('topicDistributionChart', false);
    }
}

function renderTopicDistribution(data) {
    const width = CHART_WIDTH;
    const height = CHART_HEIGHT;
    const margin = { top: 30, right: 30, bottom: 100, left: 50 };

    const svg = setupResponsiveSvg('#topicDistributionChart', width, height);

    svg.selectAll('*').remove();

    // Parse count as number
    const rows = Array.isArray(data) ? data : [];

    rows.forEach(d => {
        d.count = +d.count;
    });

    if (!rows.length || rows.every(d => d.count === 0)) {
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('class', 'no-data-label')
            .text('No topic data in selected range');
        return;
    }

    // Create scales
    const x = d3.scaleBand()
        .domain(rows.map(d => d.topic))
        .range([margin.left, width - margin.right])
        .padding(0.3);

    const y = d3.scaleLinear()
        .domain([0, d3.max(rows, d => d.count) || 1])
        .nice()
        .range([height - margin.bottom, margin.top]);

    // Color scale
    const colors = ['#0072B2', '#009E73', '#D55E00', '#CC79A7', '#E69F00', '#56B4E9', '#F0E442'];
    const colorScale = d3.scaleOrdinal()
        .domain(rows.map(d => d.topic))
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
        .data(rows)
        .enter()
        .append('rect')
        .attr('class', 'topic-bar')
        .attr('x', d => x(d.topic))
        .attr('y', d => y(d.count))
        .attr('width', x.bandwidth())
        .attr('height', d => height - margin.bottom - y(d.count))
        .attr('fill', d => colorScale(d.topic))
        .attr('opacity', 0.85)
        .style('cursor', 'pointer')
        .on('click', (_, d) => {
            dashboardState.selectedTopic = d.topic;
            renderDifficultyByTopicChart(dashboardState.difficultyData);
            renderDifficultyByTopicTable(dashboardState.difficultyData);
        })
        .on('mouseover', function() {
            d3.select(this).attr('opacity', 1);
        })
        .on('mouseout', function() {
            d3.select(this).attr('opacity', 0.85);
        });

    // Value labels on bars
    svg.selectAll('.topic-label')
        .data(rows)
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

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Image Converter Feedback (Star Ratings)
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function loadImageFeedback() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/dashboard/image-feedback`, {
            credentials: 'include'
        });
        if (!res.ok) {
            console.warn('Failed to load image feedback', res.status);
            return;
        }
        const data = await res.json();
        renderImageFeedback(data);
    } catch (e) {
        console.error('Error loading image feedback', e);
    }
}

function renderImageFeedback(data) {
    const total = data.total || 0;
    const useful = data.useful || 0;
    const notUseful = data.not_useful || 0;
    const rate = data.rate;

    // Determine sentiment
    let emoji, sentiment, color;
    if (rate === null || rate === undefined) {
        emoji = '😐'; sentiment = '–'; color = '#999';
    } else if (rate < 20) {
        emoji = '😠'; sentiment = 'Poor'; color = '#dc3545';
    } else if (rate < 40) {
        emoji = '😕'; sentiment = 'Fair'; color = '#fd7e14';
    } else if (rate < 60) {
        emoji = '😐'; sentiment = 'Neutral'; color = '#ffc107';
    } else if (rate < 80) {
        emoji = '🙂'; sentiment = 'Good'; color = '#17a2b8';
    } else {
        emoji = '😄'; sentiment = 'Excellent'; color = '#198754';
    }

    const emojiEl = document.getElementById('ifEmoji');
    if (emojiEl) { emojiEl.textContent = emoji; }

    const sentEl = document.getElementById('ifSentiment');
    if (sentEl) { sentEl.textContent = sentiment; sentEl.style.color = color; }

    const rateEl = document.getElementById('ifRate');
    if (rateEl) { rateEl.textContent = rate !== null && rate !== undefined ? rate + '%' : '–'; rateEl.style.color = color; }

    const totalEl = document.getElementById('ifTotal');
    if (totalEl) totalEl.textContent = total;

    const usefulEl = document.getElementById('ifUseful');
    if (usefulEl) usefulEl.textContent = useful;

    const notUsefulEl = document.getElementById('ifNotUseful');
    if (notUsefulEl) notUsefulEl.textContent = notUseful;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Question Difficulty Distribution by Topic (with date range)
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function loadQuestionDifficultyDistribution(startDate = '', endDate = '') {
    try {
        setChartLoading('difficultyByTopicChart', true);
        const params = new URLSearchParams();
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);

        const url = `${API_BASE_URL}/api/dashboard/question-difficulty${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, { credentials: 'include' });

        if (!res.ok) {
            console.warn('Failed to load difficulty distribution', res.status);
            return;
        }

        const data = await res.json();
        dashboardState.difficultyData = Array.isArray(data.topics) ? data.topics : [];
        renderQuestionDifficultySummary(data.overall || {});
        renderDifficultyByTopicChart(dashboardState.difficultyData);
        renderDifficultyByTopicTable(dashboardState.difficultyData);
        return data;
    } catch (e) {
        console.error('Error loading difficulty distribution', e);
        return { overall: {}, topics: [] };
    } finally {
        setChartLoading('difficultyByTopicChart', false);
    }
}

function renderQuestionDifficultySummary(overall) {
    const total = Number(overall.total || 0);
    const easyCount = Number(overall.easy_count || 0);
    const mediumCount = Number(overall.medium_count || 0);
    const hardCount = Number(overall.hard_count || 0);
    const easyPct = Number(overall.easy_pct || 0);
    const mediumPct = Number(overall.medium_pct || 0);
    const hardPct = Number(overall.hard_pct || 0);

    const totalEl = document.getElementById('qdTotal');
    const easyEl = document.getElementById('qdEasy');
    const mediumEl = document.getElementById('qdMedium');
    const hardEl = document.getElementById('qdHard');

    if (totalEl) totalEl.textContent = String(total);
    if (easyEl) easyEl.textContent = `${easyCount} (${easyPct.toFixed(1)}%)`;
    if (mediumEl) mediumEl.textContent = `${mediumCount} (${mediumPct.toFixed(1)}%)`;
    if (hardEl) hardEl.textContent = `${hardCount} (${hardPct.toFixed(1)}%)`;
}

function renderDifficultyByTopicChart(topics) {
    const width = CHART_WIDTH;
    const height = CHART_HEIGHT;
    const margin = { top: 46, right: 20, bottom: 100, left: 50 };

    const svg = setupResponsiveSvg('#difficultyByTopicChart', width, height);

    svg.selectAll('*').remove();

    let filteredTopics = Array.isArray(topics) ? [...topics] : [];
    if (dashboardState.selectedTopic) {
        filteredTopics = filteredTopics.filter(t => t.topic === dashboardState.selectedTopic);
    }

    const selectedTopicLabel = document.getElementById('selectedTopicLabel');
    if (selectedTopicLabel) {
        selectedTopicLabel.textContent = dashboardState.selectedTopic
            ? `Selected: ${dashboardState.selectedTopic}`
            : 'All topics';
    }

    if (!filteredTopics.length) {
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
            .attr('class', 'no-data-label')
            .text('No classified question data for selected filters');
        return;
    }

    const levels = ['easy_count', 'medium_count', 'hard_count'];
    const levelLabels = {
        easy_count: 'Easy',
        medium_count: 'Medium',
        hard_count: 'Hard'
    };
    const colors = {
        easy_count: '#009E73',
        medium_count: '#E69F00',
        hard_count: '#D55E00'
    };

    const x0 = d3.scaleBand()
        .domain(filteredTopics.map(d => d.topic))
        .range([margin.left, width - margin.right])
        .padding(0.2);

    const x1 = d3.scaleBand()
        .domain(levels)
        .range([0, x0.bandwidth()])
        .padding(0.12);

    const activeLevels = levels.filter(level => dashboardState.difficultySeries[level]);
    const yMax = d3.max(filteredTopics, d => {
        const values = activeLevels.map(level => +d[level]);
        return values.length ? Math.max(...values) : 0;
    }) || 1;
    const y = d3.scaleLinear()
        .domain([0, yMax])
        .nice()
        .range([height - margin.bottom, margin.top]);

    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x0))
        .selectAll('text')
        .attr('transform', 'rotate(35)')
        .style('text-anchor', 'start');

    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(Math.min(8, yMax)).tickFormat(d3.format('d')));

    const topicGroups = svg.selectAll('.difficulty-topic-group')
        .data(filteredTopics)
        .enter()
        .append('g')
        .attr('class', 'difficulty-topic-group')
        .attr('transform', d => `translate(${x0(d.topic)},0)`);

    topicGroups.selectAll('rect')
        .data(d => levels
            .filter(level => dashboardState.difficultySeries[level])
            .map(level => ({ level, value: +d[level], topic: d.topic })))
        .enter()
        .append('rect')
        .attr('x', d => x1(d.level))
        .attr('y', d => y(d.value))
        .attr('width', x1.bandwidth())
        .attr('height', d => height - margin.bottom - y(d.value))
        .attr('fill', d => colors[d.level])
        .attr('opacity', 0.9);

    // Top labels to improve readability
    topicGroups.selectAll('.difficulty-bar-label')
        .data(d => levels
            .filter(level => dashboardState.difficultySeries[level])
            .map(level => ({ level, value: +d[level] })))
        .enter()
        .append('text')
        .attr('x', d => x1(d.level) + (x1.bandwidth() / 2))
        .attr('y', d => y(d.value) - 4)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', '#555')
        .text(d => d.value);

    // Legend
    const legend = svg.append('g').attr('transform', `translate(${margin.left}, 22)`);
    levels.forEach((level, i) => {
        const row = legend.append('g').attr('transform', `translate(${i * 120}, 0)`);
        row.append('rect').attr('width', 12).attr('height', 12).attr('fill', colors[level]);
        row.append('text')
            .attr('x', 18)
            .attr('y', 10)
            .style('font-size', '12px')
            .style('text-decoration', dashboardState.difficultySeries[level] ? 'none' : 'line-through')
            .style('cursor', 'pointer')
            .attr('tabindex', 0)
            .attr('role', 'button')
            .text(levelLabels[level])
            .on('click', () => {
                dashboardState.difficultySeries[level] = !dashboardState.difficultySeries[level];
                renderDifficultyByTopicChart(dashboardState.difficultyData);
            })
            .on('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    dashboardState.difficultySeries[level] = !dashboardState.difficultySeries[level];
                    renderDifficultyByTopicChart(dashboardState.difficultyData);
                }
            });
    });
}

function renderDifficultyByTopicTable(topics) {
    const table = document.querySelector('#difficultyByTopicTable tbody');
    if (!table) return;

    table.innerHTML = '';

    let rows = Array.isArray(topics) ? [...topics] : [];
    if (dashboardState.selectedTopic) {
        rows = rows.filter(t => t.topic === dashboardState.selectedTopic);
    }

    const key = dashboardState.difficultySortKey;
    const dir = dashboardState.difficultySortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
        if (key === 'topic') return a.topic.localeCompare(b.topic) * dir;
        return ((Number(a[key]) || 0) - (Number(b[key]) || 0)) * dir;
    });

    if (!rows.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="5" class="text-center text-muted">No data for selected date range</td>';
        table.appendChild(tr);
        return;
    }

    rows.forEach(topic => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${topic.topic}</td>
            <td>${topic.easy_count} (${Number(topic.easy_pct || 0).toFixed(1)}%)</td>
            <td>${topic.medium_count} (${Number(topic.medium_pct || 0).toFixed(1)}%)</td>
            <td>${topic.hard_count} (${Number(topic.hard_pct || 0).toFixed(1)}%)</td>
            <td>${topic.total}</td>
        `;
        table.appendChild(tr);
    });
}

function reloadFilteredCharts() {
    return Promise.all([
        loadQuestionDifficultyDistribution(dashboardDateFilter.startDate, dashboardDateFilter.endDate),
        loadTopicDistribution(dashboardDateFilter.startDate, dashboardDateFilter.endDate),
        loadQuestionVolume(dashboardDateFilter.startDate, dashboardDateFilter.endDate),
        loadInputMethodTrends(dashboardDateFilter.startDate, dashboardDateFilter.endDate)
    ]);
}

function initGlobalDateFilters() {
    const applyBtn = document.getElementById('globalDateApplyBtn');
    const resetBtn = document.getElementById('globalDateResetBtn');
    const refreshBtn = document.getElementById('globalRefreshBtn');
    const preset7 = document.getElementById('presetLast7');
    const preset30 = document.getElementById('presetLast30');
    const presetTerm = document.getElementById('presetTerm');
    const startInput = document.getElementById('globalStartDate');
    const endInput = document.getElementById('globalEndDate');

    if (!applyBtn || !resetBtn || !refreshBtn || !startInput || !endInput) return;

    const runReload = async () => {
        saveFilterState();
        const [difficultyData] = await reloadFilteredCharts();
        await updateInsights(difficultyData);
        setLastUpdated();
    };

    applyBtn.addEventListener('click', async () => {
        const startDate = (startInput.value || '').trim();
        const endDate = (endInput.value || '').trim();

        if (startDate && endDate && startDate > endDate) {
            alert('Start date must be before or equal to end date.');
            return;
        }

        dashboardDateFilter.startDate = startDate;
        dashboardDateFilter.endDate = endDate;
        await runReload();
    });

    resetBtn.addEventListener('click', async () => {
        startInput.value = '';
        endInput.value = '';
        dashboardDateFilter.startDate = '';
        dashboardDateFilter.endDate = '';
        dashboardState.selectedTopic = null;
        await runReload();
    });

    refreshBtn.addEventListener('click', async () => {
        await runReload();
    });

    preset7?.addEventListener('click', async () => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 6);
        dashboardDateFilter.startDate = formatDateValue(start);
        dashboardDateFilter.endDate = formatDateValue(end);
        applyFilterInputs();
        await runReload();
    });

    preset30?.addEventListener('click', async () => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 29);
        dashboardDateFilter.startDate = formatDateValue(start);
        dashboardDateFilter.endDate = formatDateValue(end);
        applyFilterInputs();
        await runReload();
    });

    presetTerm?.addEventListener('click', async () => {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const termStartMonth = month <= 6 ? 1 : 7;
        const termEndMonth = month <= 6 ? 6 : 12;
        const start = new Date(year, termStartMonth - 1, 1);
        const end = new Date(year, termEndMonth, 0);
        dashboardDateFilter.startDate = formatDateValue(start);
        dashboardDateFilter.endDate = formatDateValue(end);
        applyFilterInputs();
        await runReload();
    });
}

function setupDifficultyTableSorting() {
    document.querySelectorAll('#difficultyByTopicTable [data-sort-key]').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-sort-key');
            if (!key) return;

            if (dashboardState.difficultySortKey === key) {
                dashboardState.difficultySortDir = dashboardState.difficultySortDir === 'asc' ? 'desc' : 'asc';
            } else {
                dashboardState.difficultySortKey = key;
                dashboardState.difficultySortDir = key === 'topic' ? 'asc' : 'desc';
            }

            renderDifficultyByTopicTable(dashboardState.difficultyData);
        });
    });
}

function setupCsvExport() {
    const btn = document.getElementById('exportDifficultyCsv');
    if (!btn) return;

    btn.addEventListener('click', () => {
        let rows = [...dashboardState.difficultyData];
        if (dashboardState.selectedTopic) {
            rows = rows.filter(r => r.topic === dashboardState.selectedTopic);
        }

        const header = ['Topic', 'EasyCount', 'EasyPct', 'MediumCount', 'MediumPct', 'HardCount', 'HardPct', 'Total'];
        const body = rows.map(r => [
            r.topic,
            r.easy_count,
            r.easy_pct,
            r.medium_count,
            r.medium_pct,
            r.hard_count,
            r.hard_pct,
            r.total
        ]);

        const csv = [header, ...body]
            .map(line => line.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'difficulty_distribution.csv';
        a.click();
        URL.revokeObjectURL(url);
    });
}

function setupTopicSelectionControls() {
    const btn = document.getElementById('clearTopicSelectionBtn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        dashboardState.selectedTopic = null;
        renderDifficultyByTopicChart(dashboardState.difficultyData);
        renderDifficultyByTopicTable(dashboardState.difficultyData);
    });
}

function setupChartActions() {
    document.querySelectorAll('.chart-card').forEach(card => {
        const svg = card.querySelector('svg');
        const title = card.querySelector('.chart-title');
        if (!svg || !title) return;

        const existing = card.querySelector('.chart-toolbar');
        if (existing) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'chart-toolbar';

        const titleContainer = document.createElement('div');
        titleContainer.appendChild(title);

        const info = document.createElement('span');
        info.className = 'chart-info';
        info.textContent = 'ⓘ';
        info.title = chartHelpText[svg.id] || 'Chart details';
        info.setAttribute('aria-label', chartHelpText[svg.id] || 'Chart details');
        title.appendChild(document.createTextNode(' '));
        title.appendChild(info);

        const actions = document.createElement('div');
        actions.className = 'chart-actions';
        const exportBtn = document.createElement('button');
        exportBtn.className = 'btn btn-sm btn-outline-secondary';
        exportBtn.textContent = 'PNG';
        exportBtn.addEventListener('click', () => exportSvgAsPng(svg.id));
        actions.appendChild(exportBtn);

        wrapper.appendChild(titleContainer);
        wrapper.appendChild(actions);
        card.insertBefore(wrapper, card.firstChild);
    });
}

function exportSvgAsPng(svgId) {
    const svg = document.getElementById(svgId);
    if (!svg) return;

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = CHART_WIDTH * 2;
        canvas.height = CHART_HEIGHT * 2;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const link = document.createElement('a');
        link.download = `${svgId}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        URL.revokeObjectURL(url);
    };
    img.src = url;
}

async function updateInsights(difficultyPayload) {
    const topics = difficultyPayload?.topics || [];
    const overall = difficultyPayload?.overall || {};

    const topStruggleEl = document.getElementById('insightTopStruggle');
    const hardDeltaEl = document.getElementById('insightHardDelta');
    const anomalyEl = document.getElementById('insightAnomaly');

    const eligible = topics.filter(t => Number(t.total || 0) >= 5);
    const top = eligible.sort((a, b) => Number(b.hard_pct || 0) - Number(a.hard_pct || 0))[0];
    if (topStruggleEl) {
        topStruggleEl.textContent = top
            ? `${top.topic} (${Number(top.hard_pct).toFixed(1)}% hard, n=${top.total})`
            : 'Not enough data yet';
    }

    let hardDeltaText = 'Need date range to compare';
    if (dashboardDateFilter.startDate && dashboardDateFilter.endDate) {
        const start = new Date(dashboardDateFilter.startDate);
        const end = new Date(dashboardDateFilter.endDate);
        const days = Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1);

        const prevEnd = new Date(start);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - (days - 1));

        const params = toDateParams(formatDateValue(prevStart), formatDateValue(prevEnd));
        try {
            const prevRes = await fetch(`${API_BASE_URL}/api/dashboard/question-difficulty?${params}`, { credentials: 'include' });
            const prevData = await prevRes.json();
            const currentHard = Number(overall.hard_pct || 0);
            const prevHard = Number(prevData?.overall?.hard_pct || 0);
            const diff = currentHard - prevHard;
            const trend = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
            hardDeltaText = `${Math.abs(diff).toFixed(1)} pts ${trend} vs previous ${days} days`;
        } catch (_) {
            hardDeltaText = 'Comparison unavailable';
        }
    }
    if (hardDeltaEl) hardDeltaEl.textContent = hardDeltaText;

    const anomalies = topics.filter(t => Number(t.total || 0) >= 8 && Number(t.hard_pct || 0) >= 60);
    if (anomalyEl) {
        anomalyEl.textContent = anomalies.length
            ? `${anomalies.length} topic(s) with >=60% hard questions`
            : 'No hard-rate anomaly detected';
    }
}

loadImageFeedback();
loadFilterState();
applyFilterInputs();
setupChartActions();
setupDifficultyTableSorting();
setupCsvExport();
setupTopicSelectionControls();
initGlobalDateFilters();
reloadFilteredCharts().then(([difficultyData]) => {
    updateInsights(difficultyData);
    setLastUpdated();
});