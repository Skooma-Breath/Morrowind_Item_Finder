self.onmessage = function(e) {
    if (e.data.type === 'search') {
        const { searchTerm, allData } = e.data;
        const results = performSearch(searchTerm, allData);
        self.postMessage({ type: 'results', results });
    }
};

function performSearch(searchTerm, allData) {
    console.log('Performing search for:', searchTerm);
    const results = {
        totalCount: 0,
        locations: {},
        npcs: []
    };

    // Search in objects
    if (allData.objects && allData.objects[searchTerm]) {
        console.log('Exact match found in objects:', searchTerm);
        console.log('Object data:', JSON.stringify(allData.objects[searchTerm], null, 2));
        const objectData = allData.objects[searchTerm];
        if (objectData.locations) {
            for (const [location, count] of Object.entries(objectData.locations)) {
                results.locations[location] = { count, containers: [] };
                results.totalCount += count;
                console.log(`Adding ${count} to total for location ${location}`);
            }
        } else {
            console.log('No locations found for this object');
        }
        console.log('Current total count:', results.totalCount);
    } else {
        console.log('No exact match found in objects');
    }

    // Search in containers
    for (const [objectName, objectData] of Object.entries(allData.objects)) {
        if (objectData.type === 'container' && objectData.contents && objectData.contents.includes(searchTerm)) {
            console.log('Match found in container:', objectName);
            if (objectData.locations) {
                for (const location of Object.keys(objectData.locations)) {
                    if (!results.locations[location]) {
                        results.locations[location] = { count: 0, containers: [] };
                    }
                    results.locations[location].containers.push(objectName);
                    results.locations[location].count++;
                    results.totalCount++;
                    console.log(`Adding 1 to total for container ${objectName} in location ${location}`);
                }
            } else {
                console.log('Container has no locations:', objectName);
            }
        }
    }

    // Search in NPCs
    if (allData.npcs) {
        for (const [npcName, npcData] of Object.entries(allData.npcs)) {
            if (npcData.inventory) {
                const matchingItems = npcData.inventory.filter(item => item.item === searchTerm);
                if (matchingItems.length > 0) {
                    console.log('Match found in NPC:', npcName);
                    console.log('Matching items:', matchingItems);
                    const count = matchingItems.reduce((sum, item) => sum + item.count, 0);
                    results.npcs.push({ name: npcName, count: count });
                    results.totalCount += count;
                    console.log(`Adding ${count} to total for NPC ${npcName}`);
                }
            }
        }
    }

    console.log('Final search results:', JSON.stringify(results, null, 2));
    return results;
}