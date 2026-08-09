// Common helpers for card selection/export modes.
export function getSelectionCheckboxes(selector = '.export-checkbox') {
  return Array.from(document.querySelectorAll(selector));
}

export function getSelectedCheckboxes(selector = '.export-checkbox') {
  return Array.from(document.querySelectorAll(`${selector}:checked`));
}

export function toggleAllSelection(selector = '.export-checkbox') {
  const checkboxes = getSelectionCheckboxes(selector);
  if (!checkboxes.length) return false;
  const allChecked = checkboxes.every(checkbox => checkbox.checked);
  checkboxes.forEach(checkbox => {
    checkbox.checked = !allChecked;
    checkbox.dispatchEvent(new Event('change'));
  });
  return !allChecked;
}

export function removeSelectionCheckboxes(selector = '.export-checkbox') {
  getSelectionCheckboxes(selector).forEach(checkbox => checkbox.remove());
}

export function ensureSelectionCheckbox(card, onChange, selectorClass = 'export-checkbox') {
  let checkbox = card.querySelector(`.${selectorClass}`);
  if (!checkbox) {
    checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = `${selectorClass} absolute top-2 right-2 w-5 h-5 accent-blue-600`;
    card.classList.add('relative');
    if (onChange) checkbox.addEventListener('change', onChange);
    card.appendChild(checkbox);
  } else {
    checkbox.classList.remove('hidden');
  }
  return checkbox;
}
