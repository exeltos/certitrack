// Typed access to form fields by name.
export function field<T extends HTMLElement = HTMLInputElement>(form: HTMLFormElement, name: string): T {
  const el = form.elements.namedItem(name);
  if (!el) throw new Error(`form field "${name}" not found`);
  return el as unknown as T;
}

/** The trimmed value of a named input, select or textarea ('' when missing). */
export function fieldValue(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  return (el?.value ?? '').trim();
}
