#!/usr/bin/env python3
import pandas as pd
import json, os

class Customer:
    def __init__(self, id, parent=None, role=None):
        self.id = id
        self.parent = parent
        self.role = role
        if (role == 'M'):
            self.role = "Member"
        if (role == 'VP'):
            self.role = "Viewing Party"
        if (role == 'B'):
            self.role = "Business"

# Read partner_role.csv
csv_path = 'data/partner_role.csv'
if not os.path.exists(csv_path):
    print(f'Missing {csv_path}, cannot build relationships')
    raise SystemExit(1)

df = pd.read_csv(csv_path, dtype=str)
customers_relationship = []
for _, row in df.iterrows():
    if str(row.get('entity_type')) == 'BR':
        customer = Customer(row.get('partner_id'), row.get('associated_partner_id'), row.get('br_type_code'))
        customers_relationship.append(customer)

# Try to load partner names
id2name = {}
if os.path.exists('data/partner.csv'):
    p = pd.read_csv('data/partner.csv', dtype={'partner_id': str})
    id2name = dict(zip(p['partner_id'].astype(str), p['partner_name'].astype(str)))

nodes = []
for c in customers_relationship:
    cid = str(c.id)
    pid = None if c.parent is None or (isinstance(c.parent, float) and pd.isna(c.parent)) else str(c.parent)
    name = id2name.get(cid, cid)
    parent_name = id2name.get(pid, None) if pid is not None else None
    nodes.append({'id': cid, 'name': name, 'parent': pid, 'parent_name': parent_name, 'role': c.role})

# compute children and links for each node
id_to_children = {n['id']: [] for n in nodes}
for n in nodes:
    if n['parent']:
        pid = n['parent']
        if pid in id_to_children:
            id_to_children[pid].append(n['id'])

# attach links (parent + children) to each node
for n in nodes:
    links = []
    if n.get('parent'):
        links.append(n['parent'])
    children = id_to_children.get(n['id'], [])
    links.extend(children)
    # de-duplicate just in case
    n['links'] = list(dict.fromkeys(links))

out_path = 'data/customers_relationship_data.js'
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, 'w', encoding='utf-8') as f:
    f.write('window.CUSTOMERS_RELATIONSHIP = ')
    json.dump({'nodes': nodes}, f, ensure_ascii=False, indent=2)
    f.write(';')

print(f'Wrote {len(nodes)} nodes to {out_path}')
