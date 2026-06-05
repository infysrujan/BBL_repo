/**
 * Forms Menu Card Actions Component
 *
 * Wraps a row of Forms Menu Card items in a responsive CSS grid.
 * The decorated element is the <fieldset> panel-wrapper that contains
 * all child cards as direct children.
 */

export default function decorate(fieldDiv, fd) {
  fieldDiv.classList.add('forms-menu-card-actions');

  // Move the legend out of grid flow if a title is authored
  const legend = fieldDiv.querySelector(':scope > legend');
  if (legend) {
    if (fd.hideTitle || fd.label?.visible === false || !fd.label?.value) {
      legend.remove();
    }
    // Otherwise CSS handles placing it above the grid (grid-column: 1/-1)
  }

  return fieldDiv;
}
