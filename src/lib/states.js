// from  https://github.com/guardian/GNMTouchpoint/blob/129e50f89458d8054eb551fa15cc56dfe0d544c6/src/classes/Country_State_ISO.cls
const normalise = (string: string) => string.toUpperCase()
const normaliseTuple = (tuple:Array<string>) => [normalise(tuple[0]), tuple[1]]
export const canadianStates = new Map([
  ['Alberta', 'AB'],
  ['British Columbia', 'BC'],
  ['Manitoba', 'MB'],
  ['New Brunswick', 'NB'],
  ['Newfoundland and Labrador', 'NL'],
  ['Nova Scotia', 'NS'],
  ['Northwest Territories', 'NT'],
  ['Nunavut', 'NU'],
  ['Ontario', 'ON'],
  ['Prince Edward Island', 'PE'],
  ['Quebec', 'QC'],
  ['Saskatchewan', 'SK'],
  ['Yukon', 'YT']].map(normaliseTuple))

export function getCanadianState (name: string): string {
  return canadianStates.get(normalise(name)) || name
}

export const USStates = new Map([
  ['Armed Forces America', 'AA'],
  ['Armed Forces', 'AE'],
  ['Armed Forces Pacific', 'AP'],
  ['Alaska', 'AK'],
  ['Alabama', 'AL'],
  ['Arkansas', 'AR'],

  ['Arizona', 'AZ'],
  ['California', 'CA'],
  ['Colorado', 'CO'],
  ['Connecticut', 'CT'],
  ['Washington DC', 'DC'],
  ['Delaware', 'DE'],
  ['Florida', 'FL'],
  ['Georgia', 'GA'],
  ['Guam', 'GU'],
  ['Hawaii', 'HI'],

  ['Iowa', 'IA'],
  ['Idaho', 'ID'],
  ['Illinois', 'IL'],
  ['Indiana', 'IN'],
  ['Kansas', 'KS'],
  ['Kentucky', 'KY'],
  ['Louisiana', 'LA'],
  ['Massachusetts', 'MA'],
  ['Maryland', 'MD'],
  ['Maine', 'ME'],

  ['Michigan', 'MI'],
  ['Minnesota', 'MN'],
  ['Missouri', 'MO'],
  ['Mississippi', 'MS'],
  ['Montana', 'MT'],
  ['North Carolina', 'NC'],
  ['North Dakota', 'ND'],
  ['Nebraska', 'NE'],
  ['New Hampshire', 'NH'],
  ['New Jersey', 'NJ'],

  ['New Mexico', 'NM'],
  ['Nevada', 'NV'],
  ['New York', 'NY'],
  ['Ohio', 'OH'],
  ['Oklahoma', 'OK'],
  ['Oregon', 'OR'],
  ['Pennsylvania', 'PA'],
  ['Puerto Rico', 'PR'],
  ['Rhode Island', 'RI'],
  ['South Carolina', 'SC'],

  ['South Dakota', 'SD'],
  ['Tennessee', 'TN'],
  ['Texas', 'TX'],
  ['Utah', 'UT'],
  ['Virginia', 'VA'],
  ['Virgin Islands', 'VI'],
  ['Vermont', 'VT'],
  ['Washington', 'WA'],
  ['Wisconsin', 'WI'],
  ['West Virginia', 'WV'],
  ['Wyoming', 'WY']
].map(normaliseTuple))

export function getUSState (name: string): string {
  return USStates.get(normalise(name)) || name
}
