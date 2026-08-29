/**
 * Money is stored and moved as integer agorot, everywhere.
 *
 * ₪7,200 is 720000, not 7200.0. Floats accumulate error, and rent, deposits and
 * commission splits are exactly the numbers you do not want to be approximately
 * right about. Shekels exist only at the two edges: what a person types in, and
 * what a person reads.
 */

/** Nominal type so a shekel amount can't be passed where agorot are expected. */
export type Agorot = number & { readonly __brand: 'agorot' };

export function toAgorot(shekels: number): Agorot {
  return Math.round(shekels * 100) as Agorot;
}

export function toShekels(agorot: number): number {
  return agorot / 100;
}

/** Split an amount by a percentage without losing an agora to rounding. */
export function share(agorot: number, percent: number): Agorot {
  return Math.round(agorot * (percent / 100)) as Agorot;
}
