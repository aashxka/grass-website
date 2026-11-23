export const sheetDials = {
  "Card travel (ms)": [240, 80, 650, 5],
  "Ease out": [0.84, 0.3, 1, 0.01],
  "Neighbor travel (%)": [100, 0, 140, 1],
  "Sheet fade (ms)": [110, 0, 400, 5],
  "Text delay (ms)": [0, 0, 300, 5],
  "Text fade (ms)": [150, 0, 400, 5],
};
export const sheetMotion = Object.fromEntries(
  Object.entries(sheetDials).map(([key, range]) => [key, range[0]])
);
