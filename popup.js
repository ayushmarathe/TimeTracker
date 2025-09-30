function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `<1m`;
}

// THIS FUNCTION IS THE FIX - It now uses your local timezone.
function getCurrentDateKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function createChart(data) {
    let chartLabels;
    let chartValues;
    if (data.length > 4) {
        const top4 = data.slice(0, 4);
        const otherSites = data.slice(4);
        chartLabels = top4.map(([domain]) => domain);
        chartValues = top4.map(([_, seconds]) => seconds);
        const otherTotalSeconds = otherSites.reduce((sum, [_, seconds]) => sum + seconds, 0);
        chartLabels.push('Other');
        chartValues.push(otherTotalSeconds);
    } else {
        chartLabels = data.map(([domain]) => domain);
        chartValues = data.map(([_, seconds]) => seconds);
    }
    const ctx = document.getElementById("chart").getContext("2d");
    if(window.myPieChart instanceof Chart) {
        window.myPieChart.destroy();
    }
    window.myPieChart = new Chart(ctx, {
        type: "pie",
        data: {
            labels: chartLabels,
            datasets: [{
                data: chartValues,
                backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const seconds = context.raw;
                            return `${context.label}: ${formatTime(seconds)}`;
                        }
                    }
                }
            }
        }
    });
}

async function displayRecentData(container) {
    container.innerHTML = '<h3>Recent Days</h3>';
    const allData = await chrome.storage.local.get(null);
    const dateKeys = Object.keys(allData).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key));
    if (dateKeys.length <= 1) {
        container.innerHTML += "<p>No data from previous days.</p>";
        return;
    }
    dateKeys.sort().reverse();
    for (const date of dateKeys) {
        if (date === getCurrentDateKey()) continue;
        const dayData = allData[date];
        const totalSeconds = Object.values(dayData).reduce((sum, time) => sum + time, 0);
        container.innerHTML += `<p><b>${date}:</b> ${formatTime(totalSeconds)}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const todayKey = getCurrentDateKey();
    const { [todayKey]: todaysData = {} } = await chrome.storage.local.get(todayKey);

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeDomain = (activeTab && activeTab.url) ? new URL(activeTab.url).hostname : "N/A";
    
    document.getElementById('active-domain').textContent = activeDomain;
    const activeTimeToday = todaysData[activeDomain] || 0;
    document.getElementById('active-time').textContent = `Time today: ${formatTime(activeTimeToday)}`;

    const sortedSites = Object.entries(todaysData).sort((a, b) => b[1] - a[1]);
    const statsTodayDiv = document.getElementById('stats-today');
    if (sortedSites.length > 0) {
        for (const [domain, seconds] of sortedSites) {
            statsTodayDiv.innerHTML += `<p><b>${domain}:</b> ${formatTime(seconds)}</p>`;
        }
        createChart(sortedSites);
    } else {
        document.getElementById('chart').style.display = 'none';
        statsTodayDiv.innerHTML = "<p>No data for today yet.</p>";
    }

    const viewAllBtn = document.getElementById('view-all-btn');
    const viewRecentBtn = document.getElementById('view-recent-btn');
    const statsRecentDiv = document.getElementById('stats-recent');

    viewAllBtn.addEventListener('click', () => {
        statsTodayDiv.style.display = statsTodayDiv.style.display === 'none' ? 'block' : 'none';
        statsRecentDiv.style.display = 'none';
    });

    viewRecentBtn.addEventListener('click', async () => {
        statsRecentDiv.style.display = statsRecentDiv.style.display === 'none' ? 'block' : 'none';
        statsTodayDiv.style.display = 'none';
        if (statsRecentDiv.style.display === 'block') {
            await displayRecentData(statsRecentDiv);
        }
    });
});