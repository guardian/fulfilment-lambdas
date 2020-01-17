export function formatPostCode (postCode: string) {
  /**
   * Supplier requirements:
   * 1) all caps
   * 2) space before final three chars
   */
  const normalised = postCode.replace(/ /g, '').toUpperCase()
  const length = normalised.length
  const outward = normalised.substring(0, length - 3)
  const inward = normalised.substring(length - 3)
  return `${outward} ${inward}`
}
