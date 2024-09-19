let allData = null;

function checkEnter(event) {
    if (event.key === "Enter") {
        searchLichen();
    }
}

async function loadData() {
    try {
        const response = await fetch('./alldata.json');
        allData = await response.json();
        console.log('All data loaded successfully');
        console.log('Data structure:', Object.keys(allData));
        document.getElementById('loadingMessage').style.display = 'none';
        document.getElementById('searchInput').disabled = false;
        document.getElementById('searchButton').disabled = false;
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('loadingMessage').textContent = 'Error loading data. Please try again later.';
    }
}

function searchLichen() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<p>Searching...</p>';

    if (allData) {
        const results = performSearch(searchTerm, allData);
        displayResults(results, searchTerm);
    } else {
        resultsDiv.innerHTML = '<p>Data not loaded. Please try again.</p>';
    }
    document.getElementById('searchInput').focus();
}

function performSearch(searchTerm, allData) {
    console.log('Performing search for:', searchTerm);
    const results = {
        totalCount: 0,
        locations: {}
    };

    if (allData.objects[searchTerm]) {
        const itemData = allData.objects[searchTerm];
        console.log('Item data found:', itemData);
        
        // Process static placements
        for (const [location, count] of Object.entries(itemData.static_locations || {})) {
            addToResults(results, location, count, 'static');
        }

        // Process containers
        for (const [containerName, containerData] of Object.entries(allData.objects)) {
            if (containerData.type === 'item' && containerData.contents) {
                const itemInContainer = containerData.contents.find(item => item.item.toLowerCase() === searchTerm.toLowerCase());
                if (itemInContainer) {
                  for (const [location, containerCount] of Object.entries(containerData.locations)) {
                      const adjustedCount = itemInContainer.count === -1 ? 1 : Math.abs(itemInContainer.count);
                      const totalCount = adjustedCount * containerCount;
                      addToResults(results, location, totalCount, 'containers', containerName, containerCount);
                  }
                }
            }
        }

        // Process NPCs
        for (const [npcName, npcData] of Object.entries(allData.npcs)) {
            const itemInNPC = npcData.inventory.find(item => item.item.toLowerCase() === searchTerm.toLowerCase());
            if (itemInNPC) {
                for (const [location, count] of Object.entries(allData.objects[npcName].locations)) {
                    const adjustedCount = itemInNPC.count === -1 ? 1 : Math.abs(itemInNPC.count);
                    addToResults(results, location, adjustedCount, 'npcs', npcName);
                }
            }
        }
    } else {
        console.log('Item not found in allData.objects');
    }

    console.log('Final search results:', results);
    return results;
}

function addToResults(results, location, count, type, container = null, containerCount = 1) {
    if (!results.locations[location]) {
        results.locations[location] = { count: 0, static: 0, containers: {}, npcs: {} };
    }
    
    if (type === 'static') {
        results.locations[location].static += count;
    } else if (type === 'containers') {
        if (!results.locations[location].containers[container]) {
            results.locations[location].containers[container] = { itemCount: 0, containerCount: 0 };
        }
        results.locations[location].containers[container].itemCount += count;
        results.locations[location].containers[container].containerCount += containerCount;
    } else if (type === 'npcs') {
        if (!results.locations[location].npcs[container]) {
            results.locations[location].npcs[container] = 0;
        }
        results.locations[location].npcs[container] += count;
    }
    
    results.locations[location].count += count;
    results.totalCount += count;
}

function displayResults(results, searchTerm) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    if (Object.keys(results.locations).length > 0) {
        resultsDiv.innerHTML += `<h2>Count by cell for '${searchTerm}':</h2>`;
        resultsDiv.innerHTML += `<p>Total occurrences: ${results.totalCount}</p>`;
        
        const sortedLocations = Object.entries(results.locations).sort((a, b) => b[1].count - a[1].count);
        
        for (const [location, info] of sortedLocations) {
            resultsDiv.innerHTML += `<p>${location}: ${info.count}</p>`;
            
            if (info.static > 0) {
                resultsDiv.innerHTML += `<p style="margin-left: 20px;">Static placed: ${info.static}</p>`;
            }
            
            for (const [container, data] of Object.entries(info.containers)) {
                resultsDiv.innerHTML += `<p style="margin-left: 20px;">${container}: ${data.itemCount} (in ${data.containerCount} container${data.containerCount > 1 ? 's' : ''})</p>`;
            }
            
            for (const [npc, count] of Object.entries(info.npcs)) {
                resultsDiv.innerHTML += `<p style="margin-left: 20px;">${npc}: ${count} (on NPC)</p>`;
            }
            
            resultsDiv.innerHTML += '<br>';
        }
    } else {
        resultsDiv.innerHTML = `<p>The item '${searchTerm}' was not found.</p>`;
    }
}

// Load data when the page loads
document.addEventListener('DOMContentLoaded', loadData);