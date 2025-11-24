# Bank Employee Fraud Detection

A lightweight system analyzing bank employee transactions and
identifying suspicious behavior.

## What is This?

This project provides a simple interface for viewing employee risk
levels, transaction patterns, and network connections. It highlights
unusual activity based on transaction volume, countries, and
salary-adjusted metrics.

## Quick Start

### Start the Server

``` bash
python3 -m http.server 8000
```

Then open:

    http://localhost:8000

## Features

### Risk Analysis

-   Detects transactions inconsistent with salary
-   Flags international or unusual transfers
-   Categorizes employees by risk level

### Network Graph

-   Visualizes connections between customers 
-   Clickable nodes for quick navigation
-   Filtration by countries 


## Structure

    /
    ├── index.html
    ├── employees/
    ├── data/
    └── assets/
