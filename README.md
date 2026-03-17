# AI-ECAM Sensor Validation System
### Airbus Hackathon · Problem Statement 1

> An AI-powered filtering layer that intercepts raw ECAM sensor data via the ARINC 429 avionics bus, validates it through a multi-stage machine learning pipeline, and re-injects only trusted readings — reducing false cockpit alerts in real time.

**[Live Demo →](https://lamar-io.github.io/AI-ECAM-validator-)**

---

## The Problem

The Electronic Centralized Aircraft Monitor (ECAM) on Airbus aircraft relies on raw sensor data to generate pilot alerts. When sensors produce inaccurate or inconsistent readings — due to EMI interference, calibration drift, or physical wear — the system triggers false warnings even when no real fault exists.

This increases pilot cognitive load, creates alarm fatigue, and risks diverting attention from actual emergencies. The Qantas Flight 32 incident generated over 80 ECAM alerts in one hour — a documented case of alert overload.

---

## The Solution

An intelligent preprocessing layer inserted between the aircraft's physical sensors and the ECAM processing units. Operating on the **ARINC 429 data bus** — the verified standard avionics protocol used in Airbus A320/A330/A340 — the pipeline validates each sensor reading through four AI stages before it reaches the ECAM system.

```
Aircraft Sensors → ARINC 429 Tap → AI Pipeline → Validated Output → ECAM Display
```

---

## AI Pipeline Stages

| Stage | Technology | Role |
|-------|-----------|------|
| 01 | **Kalman Filter** | Smooths noisy raw signals in real time before ML evaluation |
| 02 | **LSTM Neural Network** | Detects readings that break expected temporal patterns per flight phase |
| 03 | **Isolation Forest + Autoencoder** | Identifies statistical outliers without requiring pre-labeled fault data |
| 04 | **Random Forest Classifier** | Applies correct thresholds based on detected flight phase context |

All stages run on an **onboard edge processor** (target: NVIDIA Jetson / Raspberry Pi CM4) via the **ARINC 429** bus interface, ensuring end-to-end latency under 5ms.

---

## Prototype Features

This repository contains a fully interactive web prototype with five sections:

- **Overview** — Problem statement, solution architecture, and sustainability impact
- **Architecture** — Clickable pipeline diagram with deep technical details per node
- **Live Simulation** — Real-time dual sensor charts (EGT + Hydraulic Pressure) with controllable noise, fault injection, and phase switching
- **Testing Plan** — Three-phase Round 2 roadmap with runnable test scenarios
- **Technologies** — Expandable cards for all six verified technologies

---

## Tech Stack (Prototype)

| Layer | Technology |
|-------|-----------|
| Markup | HTML5 |
| Styling | CSS3 (custom properties, grid, flexbox, responsive breakpoints) |
| Logic | Vanilla JavaScript (ES6+) |
| Charts | Canvas API |
| Fonts | Google Fonts — Orbitron, IBM Plex Mono, IBM Plex Sans |
| Deployment | GitHub Pages |

---

## Deployment

The prototype is deployed via **GitHub Pages** from the `main` branch root.

To run locally, simply open `index.html` in any modern browser — no build step required.

---

## Target Metrics (Round 2)

| Metric | Target |
|--------|--------|
| False Positive Rate | < 5% |
| True Fault Detection | > 95% |
| Pipeline Latency | < 5ms |
| F1-Score | > 0.92 |
| False Negative Rate | < 2% |
| Edge CPU Load | < 40% |

---

## Team

**King Fahd University of Petroleum and Minerals (KFUPM)**
AeroNova team - AirBus Hachthon 

- Lamar - computer engineering
- Joud - aerospace enigneering 
- Rafa - aerospace enigneering 
- talah - aerospace enigneering
- reema - aerospace enigneering 

---

## Sustainability Impact

- **Flight Safety** — Reduces nuisance warnings, decreasing alarm fatigue during critical flight phases
- **Operational Efficiency** — Fewer false maintenance groundings reduce unscheduled downtime and fuel waste
- **Environmental** — More accurate engine monitoring enables better fuel management decisions, reducing per-flight emissions

---
