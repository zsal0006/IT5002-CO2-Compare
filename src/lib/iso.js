/**
 * ISO 3166-1 alpha-3 -> alpha-2.
 *
 * The GIZ country dataset keys on alpha-3; trip logs key on alpha-2 (that is
 * what Nominatim returns). Truncating "AUT" to "AU" would silently credit
 * Austria's savings to Australia, so the mapping is explicit.
 *
 * Sprint 1, T-1.1: after loading the GIZ file, run `missingAlpha2(codes)` below
 * against its distinct country codes and add anything it reports.
 */
const ISO3_TO_ISO2 = {
  ABW: 'AW', AFG: 'AF', AGO: 'AO', AIA: 'AI', ALA: 'AX', ALB: 'AL', AND: 'AD',
  ARE: 'AE', ARG: 'AR', ARM: 'AM', ASM: 'AS', ATA: 'AQ', ATF: 'TF', ATG: 'AG',
  AUS: 'AU', AUT: 'AT', AZE: 'AZ', BDI: 'BI', BEL: 'BE', BEN: 'BJ', BES: 'BQ',
  BFA: 'BF', BGD: 'BD', BGR: 'BG', BHR: 'BH', BHS: 'BS', BIH: 'BA', BLM: 'BL',
  BLR: 'BY', BLZ: 'BZ', BMU: 'BM', BOL: 'BO', BRA: 'BR', BRB: 'BB', BRN: 'BN',
  BTN: 'BT', BVT: 'BV', BWA: 'BW', CAF: 'CF', CAN: 'CA', CCK: 'CC', CHE: 'CH',
  CHL: 'CL', CHN: 'CN', CIV: 'CI', CMR: 'CM', COD: 'CD', COG: 'CG', COK: 'CK',
  COL: 'CO', COM: 'KM', CPV: 'CV', CRI: 'CR', CUB: 'CU', CUW: 'CW', CXR: 'CX',
  CYM: 'KY', CYP: 'CY', CZE: 'CZ', DEU: 'DE', DJI: 'DJ', DMA: 'DM', DNK: 'DK',
  DOM: 'DO', DZA: 'DZ', ECU: 'EC', EGY: 'EG', ERI: 'ER', ESH: 'EH', ESP: 'ES',
  EST: 'EE', ETH: 'ET', FIN: 'FI', FJI: 'FJ', FLK: 'FK', FRA: 'FR', FRO: 'FO',
  FSM: 'FM', GAB: 'GA', GBR: 'GB', GEO: 'GE', GGY: 'GG', GHA: 'GH', GIB: 'GI',
  GIN: 'GN', GLP: 'GP', GMB: 'GM', GNB: 'GW', GNQ: 'GQ', GRC: 'GR', GRD: 'GD',
  GRL: 'GL', GTM: 'GT', GUF: 'GF', GUM: 'GU', GUY: 'GY', HKG: 'HK', HMD: 'HM',
  HND: 'HN', HRV: 'HR', HTI: 'HT', HUN: 'HU', IDN: 'ID', IMN: 'IM', IND: 'IN',
  IOT: 'IO', IRL: 'IE', IRN: 'IR', IRQ: 'IQ', ISL: 'IS', ISR: 'IL', ITA: 'IT',
  JAM: 'JM', JEY: 'JE', JOR: 'JO', JPN: 'JP', KAZ: 'KZ', KEN: 'KE', KGZ: 'KG',
  KHM: 'KH', KIR: 'KI', KNA: 'KN', KOR: 'KR', KWT: 'KW', LAO: 'LA', LBN: 'LB',
  LBR: 'LR', LBY: 'LY', LCA: 'LC', LIE: 'LI', LKA: 'LK', LSO: 'LS', LTU: 'LT',
  LUX: 'LU', LVA: 'LV', MAC: 'MO', MAF: 'MF', MAR: 'MA', MCO: 'MC', MDA: 'MD',
  MDG: 'MG', MDV: 'MV', MEX: 'MX', MHL: 'MH', MKD: 'MK', MLI: 'ML', MLT: 'MT',
  MMR: 'MM', MNE: 'ME', MNG: 'MN', MNP: 'MP', MOZ: 'MZ', MRT: 'MR', MSR: 'MS',
  MTQ: 'MQ', MUS: 'MU', MWI: 'MW', MYS: 'MY', MYT: 'YT', NAM: 'NA', NCL: 'NC',
  NER: 'NE', NFK: 'NF', NGA: 'NG', NIC: 'NI', NIU: 'NU', NLD: 'NL', NOR: 'NO',
  NPL: 'NP', NRU: 'NR', NZL: 'NZ', OMN: 'OM', PAK: 'PK', PAN: 'PA', PCN: 'PN',
  PER: 'PE', PHL: 'PH', PLW: 'PW', PNG: 'PG', POL: 'PL', PRI: 'PR', PRK: 'KP',
  PRT: 'PT', PRY: 'PY', PSE: 'PS', PYF: 'PF', QAT: 'QA', REU: 'RE', ROU: 'RO',
  RUS: 'RU', RWA: 'RW', SAU: 'SA', SDN: 'SD', SEN: 'SN', SGP: 'SG', SGS: 'GS',
  SHN: 'SH', SJM: 'SJ', SLB: 'SB', SLE: 'SL', SLV: 'SV', SMR: 'SM', SOM: 'SO',
  SPM: 'PM', SRB: 'RS', SSD: 'SS', STP: 'ST', SUR: 'SR', SVK: 'SK', SVN: 'SI',
  SWE: 'SE', SWZ: 'SZ', SXM: 'SX', SYC: 'SC', SYR: 'SY', TCA: 'TC', TCD: 'TD',
  TGO: 'TG', THA: 'TH', TJK: 'TJ', TKL: 'TK', TKM: 'TM', TLS: 'TL', TON: 'TO',
  TTO: 'TT', TUN: 'TN', TUR: 'TR', TUV: 'TV', TWN: 'TW', TZA: 'TZ', UGA: 'UG',
  UKR: 'UA', UMI: 'UM', URY: 'UY', USA: 'US', UZB: 'UZ', VAT: 'VA', VCT: 'VC',
  VEN: 'VE', VGB: 'VG', VIR: 'VI', VNM: 'VN', VUT: 'VU', WLF: 'WF', WSM: 'WS',
  YEM: 'YE', ZAF: 'ZA', ZMB: 'ZM', ZWE: 'ZW'
}

/**
 * @param {string} alpha3
 * @returns {string} alpha-2 code, or 'ZZ' when the code is unknown (aggregate
 * rows such as "WORLD" or "EU27" fall through here, which is correct — they
 * have no user savings to match).
 */
export function toAlpha2(alpha3) {
  if (!alpha3) return 'ZZ'
  return ISO3_TO_ISO2[alpha3.toUpperCase()] ?? 'ZZ'
}

/** Codes in the dataset that this table does not cover. Used by T-1.1. */
export function missingAlpha2(alpha3Codes) {
  return alpha3Codes.filter((c) => !ISO3_TO_ISO2[String(c).toUpperCase()])
}

export { ISO3_TO_ISO2 }
