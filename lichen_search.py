import os
import json
import re
from collections import defaultdict

def safe_read(file_path):
    encodings = ['utf-8', 'latin-1', 'cp1252']
    for encoding in encodings:
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    print(f"Warning: Could not read file {file_path} with any of the attempted encodings.")
    return ""

def find_container_in_cells(container_name):
    cell_locations = []
    for root, dirs, files in os.walk('.\\CELL'):
        for file in files:
            if file.endswith('.json'):
                file_path = os.path.join(root, file)
                content = safe_read(file_path)
                try:
                    data = json.loads(content)
                    if isinstance(data, dict) and "FRMR" in data:
                        cell_name = data.get("NAME")
                        if cell_name is None:
                            if "DATA" in data and "grid" in data["DATA"]:
                                grid = data["DATA"]["grid"]
                                cell_name = f"{grid[0]}, {grid[1]}"
                            else:
                                cell_name = os.path.splitext(os.path.basename(file_path))[0]
                        rgnn = data.get("RGNN")
                        for obj in data["FRMR"].values():
                            if isinstance(obj, dict) and obj.get("NAME", "").lower() == container_name.lower():
                                if rgnn is not None and rgnn != "Mournhold Region":
                                    cell_locations.append(f"{cell_name}: {os.path.splitext(file)[0]}")
                                else:
                                    cell_locations.append(cell_name)
                except (json.JSONDecodeError, TypeError):
                    pass
    return cell_locations

def search_for_item(item_name):
    found_locations = []
    total_count = 0
    cell_counts = defaultdict(int)
    cell_contents = defaultdict(lambda: defaultdict(int))

    pattern = re.compile(r'\b' + re.escape(item_name.lower()) + r'\b')

    for root, dirs, files in os.walk('.'):
        for file in files:
            if file.endswith('.json'):
                file_path = os.path.join(root, file)
                if os.path.normpath(root) == os.path.normpath('list'):
                    continue
                
                content = safe_read(file_path)
                if pattern.search(content.lower()):
                    try:
                        data = json.loads(content)
                        if data is None:
                            continue
                        if isinstance(data, dict):
                            if "FRMR" in data:  # CELL file
                                cell_name = data.get("NAME")
                                if cell_name is None:
                                    if "DATA" in data and "grid" in data["DATA"]:
                                        grid = data["DATA"]["grid"]
                                        cell_name = f"{grid[0]}, {grid[1]}"
                                    else:
                                        cell_name = os.path.splitext(os.path.basename(file_path))[0]
                                
                                cell_count = 0
                                for obj in data["FRMR"].values():
                                    if isinstance(obj, dict) and pattern.search(obj.get("NAME", "").lower()):
                                        cell_count += 1
                                if cell_count > 0:
                                    cell_counts[cell_name] += cell_count
                                    cell_contents[cell_name][item_name] += cell_count
                                    total_count += cell_count
                            elif file_path.startswith('.\\NPC_\\'):
                                npc_name = os.path.splitext(os.path.basename(file_path))[0]
                                npc_count = sum(abs(item["count"]) if item["count"] < 0 else item["count"] for item in data.get("NPCO", []) if isinstance(item, dict) and pattern.search(item.get("name", "").lower()))
                                if npc_count > 0:
                                    cell_locations = find_container_in_cells(npc_name)
                                    for cell in cell_locations:
                                        cell_counts[cell] += npc_count
                                        cell_contents[cell][npc_name] += npc_count
                                        total_count += npc_count
                            elif file_path.startswith('.\\CONT\\'):
                                container_name = os.path.splitext(os.path.basename(file_path))[0]
                                container_count = sum(item["count"] for item in data.get("CNTO", []) if isinstance(item, dict) and pattern.search(item.get("name", "").lower()))
                                if container_count > 0:
                                    cell_locations = find_container_in_cells(container_name)
                                    for cell in cell_locations:
                                        cell_counts[cell] += container_count
                                        cell_contents[cell][container_name] += container_count
                                        total_count += container_count
                    except (json.JSONDecodeError, TypeError):
                        print(f"Debug: Error processing {file_path}")

    return cell_counts, cell_contents, total_count

# Usage
item_to_find = "iron_cuirass"

cell_counts, cell_contents, total_occurrences = search_for_item(item_to_find)

if cell_counts:
    print(f"Count by cell for '{item_to_find}':")
    
    for cell, count in sorted(cell_counts.items(), key=lambda x: str(x[0]) or ""):
        print(f"{cell or 'Unknown Cell'} - count: {count}")
        for container, item_count in cell_contents[cell].items():
            if container.lower() != item_to_find.lower():
                print(f"\t{container}: {item_count}")
    
    print(f"\nTotal occurrences: {total_occurrences}")
else:
    print(f"The item '{item_to_find}' was not found in any file.")

print(f"\nDebug: Total files processed: {sum(1 for _ in os.walk('.') for _ in _[2] if _.endswith('.json'))}")