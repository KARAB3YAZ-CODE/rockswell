/** Minimal VIN helpers — WMI → make without external API. */

const WMI_MAKE: Record<string, string> = {
  WBA: "BMW", WBS: "BMW", WBY: "BMW",
  WDB: "Mercedes-Benz", WDC: "Mercedes-Benz", WDD: "Mercedes-Benz", WDF: "Mercedes-Benz",
  WAU: "Audi", WUA: "Audi", TRU: "Audi",
  WVW: "Volkswagen", WV1: "Volkswagen", WV2: "Volkswagen",
  TMB: "Škoda", TMP: "Škoda",
  VSS: "SEAT",
  WF0: "Ford", WF1: "Ford",
  VF1: "Renault", VF3: "Peugeot", VF7: "Citroën",
  ZFA: "Fiat", ZFF: "Ferrari",
  SAJ: "Jaguar", SAL: "Land Rover",
  JMZ: "Mazda", JN1: "Nissan", JTD: "Toyota",
  KMH: "Hyundai", KNA: "Kia",
  LSJ: "MG", LSV: "Volkswagen",
  NMT: "Toyota",
  UU1: "Dacia",
  YV1: "Volvo", YV4: "Volvo",
  "1G1": "Chevrolet", "1FA": "Ford", "1HG": "Honda",
  "2HG": "Honda", "3VW": "Volkswagen",
  "5YJ": "Tesla",
}

export interface VinDecode {
  vin: string
  wmi: string
  make?: string
  year?: number
}

/** True for a plausible 17-char VIN (no I/O/Q). */
export function looksLikeVin(raw: string): boolean {
  const v = raw.trim().toUpperCase().replace(/\s+/g, "")
  if (v.length !== 17) return false
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(v)
}

function decodeModelYear(code: string): number | undefined {
  // Position 10 (0-indexed 9). Simplified map for 2001–2030.
  const map: Record<string, number> = {
    "1": 2001, "2": 2002, "3": 2003, "4": 2004, "5": 2005,
    "6": 2006, "7": 2007, "8": 2008, "9": 2009, A: 2010,
    B: 2011, C: 2012, D: 2013, E: 2014, F: 2015, G: 2016,
    H: 2017, J: 2018, K: 2019, L: 2020, M: 2021, N: 2022,
    P: 2023, R: 2024, S: 2025, T: 2026, V: 2027, W: 2028,
    X: 2029, Y: 2030,
  }
  return map[code]
}

export function decodeVin(raw: string): VinDecode | null {
  const vin = raw.trim().toUpperCase().replace(/\s+/g, "")
  if (!looksLikeVin(vin)) return null
  const wmi = vin.slice(0, 3)
  return {
    vin,
    wmi,
    make: WMI_MAKE[wmi],
    year: decodeModelYear(vin[9] ?? ""),
  }
}
