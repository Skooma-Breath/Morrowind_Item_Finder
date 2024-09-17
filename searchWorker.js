self.onmessage = async function(e) {
    const { searchTerm, lichenData, dataDirectory } = e.data;
    const cellCounts = {};
    const cellContents = {};
    let totalCount = 0;

    const searchPattern = new RegExp('\\b' + searchTerm + '\\b', 'i');

    const results = await Promise.all([
        searchInCells(lichenData.cell, searchPattern, dataDirectory),
        searchInNPCs(lichenData['npc_'], searchPattern, dataDirectory),
        searchInContainers(lichenData.cont, searchPattern, dataDirectory)
    ]);

    results.forEach(result => {
        for (const [cell, count] of Object.entries(result.cellCounts)) {
            cellCounts[cell] = (cellCounts[cell] || 0) + count;
            cellContents[cell] = { ...cellContents[cell], ...result.cellContents[cell] };
            totalCount += count;
        }
    });

    self.postMessage({ cellCounts, cellContents, totalCount, searchTerm });
};

async function searchInCells(cellList, searchPattern, dataDirectory) {
    const cellCounts = {};
    const cellContents = {};

    for (const cellName of cellList) {
        try {
            const response = await fetch(`${dataDirectory}CELL/${cellName}.json`);
            const data = await response.json();
            if (data && data.FRMR) {
                let cellCount = 0;
                for (const [id, obj] of Object.entries(data.FRMR)) {
                    if (obj && searchPattern.test(obj.NAME)) {
                        cellCount++;
                        cellContents[cellName] = cellContents[cellName] || {};
                        cellContents[cellName][obj.NAME] = (cellContents[cellName][obj.NAME] || 0) + 1;
                    }
                }
                if (cellCount > 0) {
                    cellCounts[cellName] = cellCount;
                }
            }
        } catch (error) {
            console.error(`Error processing CELL/${cellName}.json:`, error);
        }
    }

    return { cellCounts, cellContents };
}

async function searchInNPCs(npcList, searchPattern, dataDirectory) {
    const cellCounts = {};
    const cellContents = {};

    for (const npcName of npcList) {
        try {
            const response = await fetch(`${dataDirectory}NPC_/${npcName}.json`);
            const data = await response.json();
            if (data && data.NPCO) {
                const npcCount = data.NPCO.reduce((sum, item) => {
                    if (searchPattern.test(item.name)) {
                        return sum + Math.abs(item.count);
                    }
                    return sum;
                }, 0);
                if (npcCount > 0) {
                    const cellLocations = await findContainerInCells(npcName, dataDirectory);
                    for (const cell of cellLocations) {
                        cellCounts[cell] = (cellCounts[cell] || 0) + npcCount;
                        cellContents[cell] = cellContents[cell] || {};
                        cellContents[cell][npcName] = npcCount;
                    }
                }
            }
        } catch (error) {
            console.error(`Error processing NPC_/${npcName}.json:`, error);
        }
    }

    return { cellCounts, cellContents };
}

async function searchInContainers(contList, searchPattern, dataDirectory) {
    const cellCounts = {};
    const cellContents = {};

    for (const contName of contList) {
        try {
            const response = await fetch(`${dataDirectory}CONT/${contName}.json`);
            const data = await response.json();
            const itemList = data.CNTO || data.NPCO;
            if (itemList) {
                const contCount = itemList.reduce((sum, item) => {
                    if (searchPattern.test(item.name)) {
                        return sum + item.count;
                    }
                    return sum;
                }, 0);
                if (contCount > 0) {
                    const cellLocations = await findContainerInCells(contName, dataDirectory);
                    for (const cell of cellLocations) {
                        cellCounts[cell] = (cellCounts[cell] || 0) + contCount;
                        cellContents[cell] = cellContents[cell] || {};
                        cellContents[cell][contName] = contCount;
                    }
                }
            }
        } catch (error) {
            console.error(`Error processing CONT/${contName}.json:`, error);
        }
    }

    return { cellCounts, cellContents };
}

async function findContainerInCells(containerName, dataDirectory) {
    const cellLocations = [];
    const response = await fetch(`${dataDirectory}list/cell.json`);
    const cellList = await response.json();

    for (const cellName of cellList) {
        try {
            const response = await fetch(`${dataDirectory}CELL/${cellName}.json`);
            const data = await response.json();
            if (data && data.FRMR) {
                for (const obj of Object.values(data.FRMR)) {
                    if (obj && obj.NAME && obj.NAME.toLowerCase() === containerName.toLowerCase()) {
                        cellLocations.push(cellName);
                        break;
                    }
                }
            }
        } catch (error) {
            console.error(`Error processing CELL/${cellName}.json:`, error);
        }
    }
    return cellLocations;
}