/* eslint-env jest */

import { formatPostCode } from "../src/lib/formatters";

test("postcode formatting", () => {
  expect(formatPostCode("n19gu")).toEqual("N1 9GU");
  expect(formatPostCode("n1 9gu")).toEqual("N1 9GU"); // gu postcodes
  expect(formatPostCode("AA9A 9AA")).toEqual("AA9A 9AA"); // valid formats from https://en.wikipedia.org/wiki/Postcodes_in_the_United_Kingdom
  expect(formatPostCode("A9 9AA")).toEqual("A9 9AA");
  expect(formatPostCode("AA99 9AA")).toEqual("AA99 9AA");
  expect(formatPostCode("A99 9AA")).toEqual("A99 9AA");
  expect(formatPostCode("A9A 9AA")).toEqual("A9A 9AA");
  expect(formatPostCode("AA9A9AA")).toEqual("AA9A 9AA");
});
