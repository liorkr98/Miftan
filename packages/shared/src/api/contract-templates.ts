import { z } from 'zod';

/**
 * The template library.
 *
 * Built-ins ship with the product and are never editable in place — editing one
 * clones it to the owner first. That keeps two things true: one owner's edit
 * cannot reach another owner's document, and shipping an improved built-in does
 * not silently rewrite a clause somebody has been signing for a year.
 */

export const variableKindSchema = z.enum(['text', 'money', 'date', 'number', 'boolean']);

export const templateVariableSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: variableKindSchema,
  from: z.string().nullish(),
  required: z.boolean(),
  hint: z.string().nullish(),
});

export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  useWhen: z.string(),
  body: z.string(),
  variables: z.array(templateVariableSchema),
  /** Ships with the product; editing clones it first */
  isBuiltIn: z.boolean(),
  /** Which built-in this was cloned from, if any */
  basedOn: z.string().nullable(),
});

export const templateListSchema = z.object({
  templates: z.array(templateSchema),
  /** Rendered on every document, not buried in settings */
  disclaimer: z.string(),
});

export const saveTemplateSchema = z.object({
  /** Present when cloning a built-in or editing an existing clone */
  basedOn: z.string().nullish(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(400).default(''),
  useWhen: z.string().trim().max(400).default(''),
  body: z.string().trim().min(50).max(60_000),
  variables: z.array(templateVariableSchema).max(60),
});

/**
 * Filling one in.
 *
 * `leaseId` pre-fills from what the system already knows; `values` is whatever
 * the owner typed or corrected. The owner's input wins, because the lease can
 * be wrong and the contract is the thing being signed.
 */
export const renderTemplateSchema = z.object({
  leaseId: z.string().nullish(),
  values: z.record(z.string(), z.string()).default({}),
});

export const renderedSchema = z.object({
  templateId: z.string(),
  templateName: z.string(),
  text: z.string(),
  /** Required placeholders still unfilled. The document is not ready. */
  missing: z.array(z.string()),
  /** What was taken from the lease rather than typed */
  prefilled: z.array(z.string()),
  disclaimer: z.string(),
});

export type TemplateView = z.infer<typeof templateSchema>;
export type RenderedContract = z.infer<typeof renderedSchema>;
