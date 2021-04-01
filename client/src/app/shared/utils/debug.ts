/**
 * Outputs all the entries of a generator.
 *
 * <pre>
 * let gen;
 * for (const x of (gen = $$$DEBUG$$$_generator(...) {
 * }
 * gen.return(); // You want to call this to guarantee output if you don't fully iterate through
 * </pre>
 *
 * @param gen the generator
 * @param adapter function to calculate the contents of each table row
 */
export function* $$$DEBUG$$$_generator<T>(gen: Iterable<T>, adapter: (element: T) => any[]) {
  const results: any[] = [];
  try {
    for (const entry of gen) {
      results.push(adapter(entry));
      yield entry;
    }
  } finally {
    console.table(results);
  }
}
