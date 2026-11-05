// Storage-compatible identifiers. This is not a credential or a cryptographic signature.
export function contentKey(value: string) {
  return Array.from({ length: 8 }, (_, index) => {
    let hash = 2166136261 ^ Math.imul(index + 1, 0x9e3779b1);
    for (let i = 0; i < value.length; i++)
      hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(16).padStart(8, "0");
  }).join("");
}
