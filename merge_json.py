import json
import os
import logging
import re

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

dataDirectory = './'
listDirectory = './list/'

def normalize_location(location):
    location = location.title()
    special_cases = {
        "13, -1": "Erabenimsun Camp",
        "2, -7": "Dren Plantation",
        "13, -8": "Molag Mar",
        "17, 4": "Sadrith Mora",
        "18, 4": "Sadrith Mora",
        "11, 14": "Vos",
    }
    if location in special_cases:
        return special_cases[location]
    if location.startswith("Tel Vos"):
        return "Tel Vos"
    location = re.sub(r'\bTel\b', 'Tel', location)
    location = re.sub(r'\bSt\.\b', 'Saint', location)
    location = re.sub(r'\bFt\.\b', 'Fort', location)
    return location

def load_json_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            return json.load(file)
    except FileNotFoundError:
        logging.error(f"File not found: {file_path}")
    except json.JSONDecodeError as e:
        logging.error(f"JSON decode error in file {file_path}: {str(e)}")
    except Exception as e:
        logging.error(f"Error reading file {file_path}: {str(e)}")
    return None

def process_cell_file(cell_name, data):
    region = data.get('RGNN', '')
    objects = [obj['NAME'].lower() for obj in data.get('FRMR', {}).values() if 'NAME' in obj]
    return normalize_location(cell_name), region, objects

def process_cont_file(cont_name, data):
    contents = []
    npco_data = data.get('NPCO') or []
    cnto_data = data.get('CNTO') or []
    
    for item in npco_data + cnto_data:
        if isinstance(item, dict) and 'name' in item and 'count' in item:
            contents.append({'item': item['name'].lower(), 'count': item['count']})
    return cont_name.lower(), contents

def process_npc_file(npc_name, data, all_data):
    inventory = []
    npco_data = data.get('NPCO') or []
    for item in npco_data:
        if isinstance(item, dict) and 'name' in item and 'count' in item:
            inventory.append({'item': item['name'].lower(), 'count': item['count']})
    locations = find_object_in_cells(npc_name, all_data)
    return npc_name.lower(), inventory, locations

def find_object_in_cells(object_name, all_data):
    locations = {}
    object_name_lower = object_name.lower()
    for cell_name, cell_data in all_data['cells'].items():
        for obj in cell_data['objects']:
            if object_name_lower == obj.lower():
                locations[cell_name] = 1
    return locations

def add_item_to_data(all_data, item_name, location, count, container=None):
    item_name = item_name.lower()
    if item_name not in all_data['objects']:
        all_data['objects'][item_name] = {"type": "item", "locations": {}, "containers": [], "static_locations": {}}
    
    if location:
        if container:
            if container not in all_data['objects'][item_name]['containers']:
                all_data['objects'][item_name]['containers'].append(container.lower())
        else:
            if location not in all_data['objects'][item_name]['static_locations']:
                all_data['objects'][item_name]['static_locations'][location] = 0
            all_data['objects'][item_name]['static_locations'][location] += count

        if location not in all_data['objects'][item_name]['locations']:
            all_data['objects'][item_name]['locations'][location] = 0
        all_data['objects'][item_name]['locations'][location] += count

def main():
    all_data = {"objects": {}, "npcs": {}, "cells": {}}

    cell_list = load_json_file(f"{listDirectory}cell.json") or []
    npc_list = load_json_file(f"{listDirectory}npc_.json") or []
    cont_list = load_json_file(f"{listDirectory}cont.json") or []

    # Process CELL files
    for cell_name in cell_list:
        data = load_json_file(f"{dataDirectory}CELL/{cell_name}.json")
        if data:
            cell_name, region, objects = process_cell_file(cell_name, data)
            all_data['cells'][cell_name] = {"region": region, "objects": objects}
            for obj in objects:
                add_item_to_data(all_data, obj, cell_name, 1)
        else:
            logging.warning(f"Skipping cell file: {cell_name}")

    # Process CONT files
    for cont_name in cont_list:
        data = load_json_file(f"{dataDirectory}CONT/{cont_name}.json")
        if data:
            cont_name, contents = process_cont_file(cont_name, data)
            if cont_name not in all_data['objects']:
                all_data['objects'][cont_name] = {"type": "container", "locations": {}, "contents": []}
            all_data['objects'][cont_name]['contents'] = contents
            locations = find_object_in_cells(cont_name, all_data)
            for item in contents:
                for location in locations:
                    add_item_to_data(all_data, item['item'], location, item['count'], cont_name)

    # Process NPC_ files
    for npc_name in npc_list:
        data = load_json_file(f"{dataDirectory}NPC_/{npc_name}.json")
        if data:
            try:
                npc_name, inventory, locations = process_npc_file(npc_name, data, all_data)
                all_data['npcs'][npc_name] = {"inventory": inventory, "locations": locations}
                all_data['objects'][npc_name] = {"type": "npc", "locations": locations}
                for item in inventory:
                    for location in locations:
                        add_item_to_data(all_data, item['item'], location, item['count'], npc_name)
            except Exception as e:
                logging.error(f"Error processing NPC file {npc_name}: {str(e)}")
        else:
            logging.warning(f"Skipping NPC file: {npc_name}")

    # Normalize all location names
    for obj in all_data['objects'].values():
        if 'locations' in obj:
            obj['locations'] = {normalize_location(k): v for k, v in obj['locations'].items()}
        if 'static_locations' in obj:
            obj['static_locations'] = {normalize_location(k): v for k, v in obj['static_locations'].items()}

    for npc in all_data['npcs'].values():
        if 'locations' in npc:
            npc['locations'] = {normalize_location(k): v for k, v in npc['locations'].items()}

    all_data['cells'] = {normalize_location(k): v for k, v in all_data['cells'].items()}

    # Write the combined data to alldata.json
    with open('alldata.json', 'w', encoding='utf-8') as f:
        json.dump(all_data, f, indent=2, ensure_ascii=False)

    logging.info("alldata.json has been created successfully.")

    # Debug output
    logging.debug(f"Total objects: {len(all_data['objects'])}")
    logging.debug(f"Total NPCs: {len(all_data['npcs'])}")
    logging.debug(f"Total cells: {len(all_data['cells'])}")

    # Check specific items
    for item in ['iron_cuirass', 'chitin short bow']:
        if item in all_data['objects']:
            total_count = sum(all_data['objects'][item]['locations'].values())
            logging.debug(f"Total count for {item}: {total_count}")
        else:
            logging.debug(f"{item} not found in the data")

if __name__ == "__main__":
    main()