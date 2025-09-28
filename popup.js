function formatTime(seconds){
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);

    return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
}

chrome.storage.local.get(null, (result) => {
    const statsDiv = document.getElementById("stats");

    if(Object.keys(result).length === 0) {
        statsDiv.innerHTML = "<p>No Data Yet</p>";
        return;
    }

    // Sort sites by time spent descending
    const sortedSites = Object.entries(result).sort((a,b) => b[1] - a[1]);
    statsDiv.innerHTML = "";

    // Display textual stats
    for(const [domain, seconds] of sortedSites) {
        statsDiv.innerHTML += `<p><b>${domain}:</b> ${formatTime(seconds)}</p>`;
    }

    // Prepare data for Pie Chart
    const labels = sortedSites.map(([domain]) => domain);
    const data = sortedSites.map(([_, seconds]) => Math.floor(seconds / 60));

    const ctx = document.getElementById("chart");

    new Chart(ctx, {
        type: "pie",
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    "#FF6384", "#36A2EB", "#FFCE56", "#4CAF50", "#9C27B0",
                    "#00BCD4", "#FF5722", "#8BC34A", "#E91E63", "#03A9F4"
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
});
