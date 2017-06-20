export function formatPostCode (postCode: string) {
  /**
   * Supplier requirements:
   * 1) all caps
   * 2) space before final three chars
   */
  let normalised = postCode.replace(/ /g, '').toUpperCase()
  let length = normalised.length
  let head = normalised.substring(0, length - 3)
  let tail = normalised.substring(length - 3)
  return `${head} ${tail}`
}
