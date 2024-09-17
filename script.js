const dataDirectory = './';
const listDirectory = './list/';
let lichenData = {};
let cachedData = {};

// Web Worker for search operations
const searchWorker = new Worker('searchWorker.js');

async function loadJSONFiles() {
    try {
        const listFiles = ['cell.json', 'npc_.json', 'cont.json'];
        const promises = listFiles.map(file => 
            fetch(`${listDirectory}${file}`).then(response => response.json())
        );
        const results = await Promise.all(promises);
        listFiles.forEach((file, index) => {
            lichenData[file.split('.')[0]] = results[index];
        });
        console.log('All data loaded successfully');
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

    if (cachedData[searchTerm]) {
        displayResults(cachedData[searchTerm], searchTerm);
        return;
    }

    searchWorker.postMessage({ searchTerm, lichenData, dataDirectory });
}

searchWorker.onmessage = function(e) {
    const { cellCounts, cellContents, totalCount, searchTerm } = e.data;
    cachedData[searchTerm] = { cellCounts, cellContents, totalCount };
    displayResults({ cellCounts, cellContents, totalCount }, searchTerm);
};

function displayResults({ cellCounts, cellContents, totalCount }, searchTerm) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    if (Object.keys(cellCounts).length > 0) {
        resultsDiv.innerHTML += `<h2>Count by cell for '${searchTerm}':</h2>`;
        const sortedCells = Object.entries(cellCounts).sort((a, b) => a[0].localeCompare(b[0], undefined, {sensitivity: 'base'}));
        
        for (const [cell, count] of sortedCells) {
            resultsDiv.innerHTML += `<p>${cell} - count: ${count}</p>`;
            if (cellContents[cell]) {
                for (const [container, itemCount] of Object.entries(cellContents[cell])) {
                    if (container.toLowerCase() !== searchTerm.toLowerCase()) {
                        resultsDiv.innerHTML += `<p style="margin-left: 20px;">${container}: ${itemCount}</p>`;
                    }
                }
            }
        }

        resultsDiv.innerHTML += `<h3>Total occurrences: ${totalCount}</h3>`;
    } else {
        resultsDiv.innerHTML = `<p>The item '${searchTerm}' was not found in any file.</p>`;
    }
}

// Load data when the page loads
document.addEventListener('DOMContentLoaded', loadJSONFiles);