import pandas as pd
import numpy as np
from collections import defaultdict

df = pd.read_csv('data/partner_role.csv')
total_customers = []

class Customer :
    #role = role dans le business relationship (contract)
    def __init__(self, id, responsable = None, role = None, br_id = None, account_id = None, iban = None, solde = 0):
        self.id = id
        self.responsable = responsable
        self.role = role
        if (role == 'M') :
            self.role = "Member"
        if (role == 'VP') :
            self.role = "Viewing Party"
        if (role == 'B') :
            self.role = "Business"
        self.br_id = br_id
        self.account_id = account_id
        self.iban = iban
        self.iban_from_other_country = []
        self.from_other_country = []
        self.transfer_type = []
        self.nb_of_transactions = 0
        self.amount = []
        self.date = []
        self.solde = solde
        self.score = 0

df1 = df.drop(columns=["relationship_start_date", "relationship_end_date", "partner_class_code"])
customers_relationship = []

for index, row in df1.iterrows():
    if row['entity_type'] == "BR": 
        customer = Customer(row['partner_id'], row['associated_partner_id'], row['br_type_code'], row['entity_id'])  
        customers_relationship.append(customer)

# store account_id
df_business_rel = pd.read_csv('data/br_to_account.csv')

df_business_rel["br_id"] = (
    df_business_rel["br_id"]
    .astype(str)
    .str.strip()
    .str.replace("'", "", regex=False)
)

for customer in customers_relationship : 
    row = df_business_rel[df_business_rel["br_id"] == customer.br_id]
    if not row.empty:
        account_id = row["account_id"].values[0] 
        if pd.notna(account_id): 
            customer.account_id = account_id

df_account = pd.read_csv('data/account.csv')

#calcul of total amount of customers
total_customers = customers_relationship.copy()

existing_ids = {c.account_id for c in customers_relationship}
for id in df_account["account_id"]:
    if id not in existing_ids:
        total_customers.append(Customer(id=id))

#store iban
for customer in total_customers : 
    row = df_account[df_account["account_id"] == customer.account_id]
    if not row.empty :
        iban = row["account_iban"].values[0] 
        if pd.notna(iban): 
            customer.iban = iban

#risk from country
df_transactions = pd.read_csv('data/transactions_fixed.csv')
for customer in total_customers : 
    row = df_transactions[df_transactions["Account ID"] == customer.account_id]
    if not row.empty :
        for _, transaction in row.iterrows():
            customer.nb_of_transactions += 1
            customer.transfer_type.append(transaction["Transfer_Type"])
            customer.amount.append(transaction["Amount"])
            ext_iban = transaction["ext_counterparty_Account_ID"]
            customer.date.append(transaction["Date"])
            customer.solde = transaction["Balance"]
            if pd.notna(ext_iban) : 
                if (ext_iban[:2] != customer.iban[:2]):
                    customer.iban_from_other_country.append(ext_iban)

for customer in total_customers : 
    for ext_iban in customer.iban_from_other_country:
        row = df_account[df_account["account_iban"] == ext_iban]
        if not row.empty :
            account_id = row["account_id"].values[0] 
            if pd.notna(account_id): 
                customer.from_other_country.append(account_id)

# risk computation
max_score = 0
for customer in total_customers:
    score = 0
    score += customer.nb_of_transactions
    risky_types = ["MTCUSD", "MTIBK"]
    nb_of_risky_types = sum(1 for t in customer.transfer_type if t in risky_types)
    score += (len(customer.transfer_type) - nb_of_risky_types) * 0.5

    if customer.amount:
        mean_amount = np.mean(customer.amount)
        std_amount = np.std(customer.amount)
        high_amounts = sum(1 for a in customer.amount if a > mean_amount + 3*std_amount)
        score += high_amounts * 5 

    same_date = defaultdict(int)
    for date in customer.date:
        same_date[date] += 1
    nb_of_same_date = sum(v-1 for v in same_date.values() if v > 1)
    score += len(same_date) * nb_of_same_date * 3  

    if getattr(customer, "role", None) == "Viewing Party":
        score *= 1.1
    elif getattr(customer, "role", None) == "Business":
        score *= 1.05

    max_score = max(max_score, score)

# normalisation 
for customer in total_customers:
    score = customer.nb_of_transactions
    risky_types = ["MTCUSD", "MTIBK"]
    nb_of_risky_types = sum(1 for t in customer.transfer_type if t in risky_types)
    score += (len(customer.transfer_type) - nb_of_risky_types) * 1

    if customer.amount:
        mean_amount = np.mean(customer.amount)
        std_amount = np.std(customer.amount)
        high_amounts = sum(1 for a in customer.amount if a > mean_amount + 4*std_amount)
        score += high_amounts * 7

    same_date = defaultdict(int)
    for date in customer.date:
        same_date[date] += 1
    nb_of_same_date = sum(v-1 for v in same_date.values() if v > 1)
    score += len(same_date) * nb_of_same_date * 3

    if getattr(customer, "role", None) == "Viewing Party":
        score *= 1.1
    elif getattr(customer, "role", None) == "Business":
        score *= 1.05

    # Normalisation logarithmique pour éviter score quasi nul
    customer.score = round(np.log1p(score) / np.log1p(max_score) * 100, 2)
