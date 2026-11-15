/** Line-art paths for the five supported transport modes. */
const MODE_ICONS = {
  walking: 'M13 2.5a2 2 0 1 1 0 4a2 2 0 1 1 0-4zM11 21l2-6-3-3 1-4 3 3 3 1M10 8l-3 3',
  cycling:
    'M6 12.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7zM18 12.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7zM6 16l4-7h5l3 7M10 9l2 7M14 6h2',
  train_national: 'M9 3h6a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM6 10h12M9 20l-2 2M15 20l2 2M9 16l-1 4M15 16l1 4',
  bus_city: 'M6 3h12a2 2 0 0 1 2 2v12H4V5a2 2 0 0 1 2-2zM4 10h16M7 17v3M17 17v3M8 13.5h.01M16 13.5h.01',
  car_average: 'M5 15l1.6-5.2A2 2 0 0 1 8.5 8.4h7a2 2 0 0 1 1.9 1.4L19 15M4 15h16v3H4zM7 18v2M17 18v2',
}

export function iconFor(modeKey) {
  return MODE_ICONS[modeKey] ?? MODE_ICONS.car_average
}
