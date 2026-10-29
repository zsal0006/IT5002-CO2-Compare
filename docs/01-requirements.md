# 1. Requirements Specification

Project: **CO2 Compare** — a carbon footprint comparison platform
Module: IT5002
Status: v1.1 — reconciled with the team's epics, user stories and wireframes

> The team's user stories in `09-epics-and-traceability.md` are the agreed statement
> of scope. This document restates them as numbered requirements so the test plan can
> reference them; where the two disagree, the user stories win.

---

## 1.1 Problem statement

People choosing how to make a journey rarely have a concrete number for what that
choice costs in CO₂. Abstract annual figures ("transport is 20% of emissions") do
not change behaviour; a per-trip number does. CO2 Compare closes that gap: enter two
points, see what each transport mode emits for that exact route, log the mode you
actually used, and see the saving aggregated across everyone in your country and
worldwide.

## 1.2 Solution summary

A single-page web application that:

1. Takes a start and end location as free text.
2. Geocodes both to coordinates and computes the route distance.
3. Multiplies distance by per-mode emission factors to produce a comparison.
4. Lets the user log the mode they actually took, recording the CO₂ saved versus a
   car baseline.
5. Aggregates logged savings by country and globally.
6. Presents national and global transport-sector emissions for context.

## 1.3 Functional requirements

Each requirement has an ID (`FR-n`), a priority (**Must** / **Should** / **Stretch**)
and an acceptance test (see `08-testing-and-acceptance.md`).

### Calculator

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | The user can enter a start location and an end location as free text. | Must |
| FR-2 | The system resolves each location to coordinates and shows the user which place it matched, so a wrong match can be corrected. | Must |
| FR-3 | The system computes the distance between the two points in kilometres. | Must |
| FR-4 | The system computes CO₂e for driving, bus, train, cycling and walking for that distance. Cycling and walking are 0. | Must |
| FR-5 | Results are shown as a comparison chart plus an accessible data table. | Must |
| FR-6 | The user can switch the car sub-type (petrol / diesel / electric) and see the comparison update. | Should |
| FR-7 | The system shows the route on a map. | Stretch |
| FR-8 | The system supports a return-trip toggle (×2 distance). | Should |
| FR-21 | The user can fill the start field from the browser's geolocation, on an explicit click. *(story 1.2)* | Could |
| FR-22 | The results state the headline saving as a sentence — "switching from X to Y saves Z". *(story 2.2)* | Must |

### Logging and savings

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-9 | The user can select the mode they actually used and log the trip. | Must |
| FR-10 | Logging records distance, mode, emissions, and CO₂ saved versus the car baseline. | Must |
| FR-11 | Saved CO₂ is computed server-side, not accepted from the client. | Must |
| FR-12 | No personally identifying information is collected or stored at any point. A logged trip stores only mode, distance, CO₂ saved, country, region and date — never an address or a coordinate. *(story 6.2)* | Must |
| FR-13 | The user sees their own cumulative saving for the current browser session. | Should |

### Dashboard

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-14 | A dashboard shows total CO₂ saved globally by all users. | Must |
| FR-15 | The dashboard shows CO₂ saved broken down by country. | Must |
| FR-16 | The dashboard shows national transport-sector emissions for a country selected by the user. | Must |
| FR-17 | The dashboard shows a time series of transport emissions (1970–2024) for the selected country. | Must |
| FR-18 | The dashboard shows transport emissions as a share of that country's total emissions. | Should |
| FR-19 | Up to three countries can be compared on the same time series. | Stretch |
| FR-23 | Savings totals are aggregated by sub-national region (state or province) as well as by country. *(story 4.1)* | Must |
| FR-24 | Savings are broken down by transport mode, ranked by kilograms avoided. *(story 4.2)* | Should |
| FR-25 | A world map shades countries by transport emissions, with a legend, hover detail, and selection loading that country's trend. *(story 5.3)* | Must |
| FR-26 | Every calculation reads its emission factors from the database, not from values written into application code. *(story 6.1)* | Must |

### Information

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-20 | A "Learn more" page explains the methodology, lists every data source with a link, and states the assumptions and limitations. | Must |

## 1.4 Non-functional requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | First meaningful paint under 2s on a typical broadband connection. |
| NFR-2 | Calculator result returned within 3s of submit, including external geocoding and routing calls. |
| NFR-3 | Usable on mobile viewports from 360px wide. |
| NFR-4 | WCAG 2.1 AA: keyboard-operable, 4.5:1 text contrast, no information carried by colour alone, charts mirrored by a data table. |
| NFR-5 | Works in current Chrome, Firefox, Edge and Safari. |
| NFR-6 | No API keys committed to the repository. |
| NFR-7 | External API failures degrade gracefully — the app falls back to straight-line distance and tells the user it has done so. |
| NFR-8 | Every displayed emission number is traceable to a cited source. |

## 1.5 Out of scope (v1)

- User accounts, login, saved trip history across devices.
- Multi-leg or mixed-mode journeys.
- Real-time public transport timetables.
- Flight routing.
- Carbon offset purchase.

## 1.6 Assumptions

- Emission factors are per **passenger**-kilometre at average occupancy, not per vehicle-kilometre.
- The "saved" baseline is an average petrol car. This is a convention, not a claim about what the user would otherwise have done, and is stated on-screen.
- Country and region attribution use the trip's **start** point.
- "Region" means a state or province. It is coarse enough that it cannot identify a
  traveller, and nothing finer is recorded.
- Public (unkeyed) OSM services are acceptable for a coursework-scale load.
