# Detection for Bank Employee

A fraud detection and risk analysis system for monitoring bank employee transactions and identifying suspicious patterns.

## 📋 Overview

This system analyzes employee banking transactions to calculate risk scores and detect potential fraudulent behavior. It provides visual representations of transaction networks and detailed employee profiles.

## ✨ Features

### 🎯 Risk Calculation
The system calculates employee risk based on:
- **High-value transactions** relative to employee salary
- **International transfers** from unusual or high-risk countries
- **Transaction pattern anomalies**
- **Risk categorization** (low, medium, high) for filtering

### 🕸️ Transaction Network Graph
- **Interactive homepage** with network visualization
- Each **node represents a person** (employee or transaction partner)
- **Edges connect people** who have made transactions together
- **Click on a node** to view detailed profile and transaction history
- **Filter options**: risk level, transaction amounts, countries

### 👤 Employee Profile Cards
Visual "visit card" for each employee displaying:
- 📸 **Photo** and name
- 💰 **Salary** information
- 📊 **Transaction flow** graph
- 🔍 **External verification** (LinkedIn, public records)
- ⚠️ **Risk indicators**

### 🔎 Fraud Detection
When high-risk employees are identified:
- View **connected transaction partners** who may also be involved
- Cross-reference with **external data sources**
- Identify **suspicious transaction patterns**
