/* A styleable dropdown with the following behaviour:
 *
 * - only allows one selection at a time
 * - stores and allows searching metadata for each item
 * - doesn't fire change until an option is clicked on or enter is pressed
 * - uses the following structure for HTML:
 *
 *   <dropdown>
 *     <input type="checkbox" class="dropdown"/>
 *     <label tabindex="0"></label>
 *     <datalist>
 *       <template>
 *         <dropdownoption>
 *           <input type="checkbox"/>
 *           <label tabindex="-1"></label>
 *         </dropdownoption>
 *       </template>
 *     </datalist>
 *   </dropdown>
 *
 * - which can be populated by passing to setOptions:
 *
 *  [
 *    [value, title, {fieldname: ..., ...}],
 *    ...
 *  ]
 *
 * - fieldname etc is set on the .dataset
 * - value, title and .dataset are copied to the dropdown when changed
 */

export default class Dropdown {
  constructor(dropdownId, selectedIndex) {
    this._el = document.querySelector(`#${dropdownId}`);
    this._input = this._el.querySelector(':scope > input');
    this._label = this._el.querySelector(':scope > label');
    const id = `dropdown_${this._el.id}`;
    this._input.id = id;
    this._label.htmlFor = id;
    this._datalist = this._el.querySelector(':scope > datalist');
    this._index;
    this._highlight;
    this._options = [];
    this._el.addEventListener('keydown', e => this.handleKeyDown(e));
    this._el.addEventListener('click', e => this.handleClick(e));
    this._label.addEventListener('blur', e => this.handleBlur(e));
  }

  setOptions(data) {
    this.clearOptions();
    this._data = data;
    const template = this._datalist.querySelector(':scope > template');
    for (const [index, [value, title, dataset]] of data.entries()) {
      const dropdownoption = template.content.firstElementChild.cloneNode(true);
      const input = dropdownoption.querySelector(':scope > input');
      const label = dropdownoption.querySelector(':scope > label');
      const id = `dropdownoption_${this._el.id}_${index}`;
      input.id = id;
      input.value = value;
      label.htmlFor = id;
      label.innerText = title;
      for (const [k, v] of Object.entries(dataset)) {
        input.dataset[k] = v;
      }
      this._datalist.appendChild(dropdownoption);
      this._options.push(dropdownoption);
    }
  }

  clearOptions() {
    for (const option of this._options) {
      this._datalist.removeChild(option);
    }
    this._options.length = 0;
  }

  expand() {
    this._input.checked = true;
  }

  get expanded() {
    return this._input.checked;
  }

  collapse() {
    this._input.checked = false;
  }

  get index() {
    return this._index;
  }

  set index(index) {
    const highlight = this._options[index];
    const input = highlight.querySelector(':scope > input');
    const label = highlight.querySelector(':scope > label');
    this._input.value = input.value;
    this._label.innerText = label.innerText;
    for (const [k, v] of Object.entries(input.dataset)) {
      this._el.dataset[k] = v;
    }
    const oldIndex = this._index;
    this._index = index;
    this.setHighlight(index, false);
    return oldIndex;
  }

  clearHighlight() {
    // FIXME: we should ensure we never have a null highlight when calling clearHighlight
    if (this._highlight == null) return;
    const highlight = this._options[this._highlight];
    const input = highlight.querySelector(':scope > input');
    input.checked = false;
    this._highlight = null;
  }

  setHighlight(index, scroll = false) {
    if (index != this._highlight) {
      this.clearHighlight();
      const highlight = this._options[index];
      const input = highlight.querySelector(':scope > input');
      input.checked = true;
      if (scroll) highlight.scrollIntoView({'block': 'center'});
      this._highlight = index;
    }
  }

  triggerChange() {
    const evt = new Event('change', {'bubbles': true});
    this._el.dispatchEvent(evt);
  }

  handleKeyDown(e) {
    let direction = 0;
    switch (e.key) {
      case "Enter":
        if (this.expanded) {
          const oldIndex = this.index;
          this.index = this._highlight;
          this.collapse();
          if (oldIndex != this._highlight) this.triggerChange();
        } else {
          // TODO: submit closest form
        }
        e.preventDefault();
        return;
      case "Esc":
      case "Escape":
        this.collapse();
        this.handleCollapse();
        e.preventDefault();
        return;
      case " ":
        direction = 0;
        break;
      case "Down":
      case "ArrowDown":
        direction = 1;
        break;
      case "Up":
      case "ArrowUp":
        direction = -1;
        break;
      default:
        return;
    }

    if (!this.expanded && direction >= 0) {
      this.expand();
      this.handleExpand();
      e.preventDefault();
      return;
    }

    const newHighlight = (this._highlight + direction + this._options.length) % this._options.length;
    this.setHighlight(newHighlight, true);
    e.preventDefault();
  }

  handleClick(e) {
    if (e.target == this._input) {
      if (e.target.checked) {
        this.handleExpand();
      } else {
        this.handleCollapse();
      }
    } else if (e.target.matches('dropdownoption > input')) {
      const index = this._options.indexOf(e.target.parentElement);
      const oldIndex = this.index;
      this.index = index;
      this.collapse();
      this.handleCollapse();
      if (index != oldIndex) this.triggerChange();
    }
  }

  handleBlur(e) {
    if (e.relatedTarget?.matches('dropdownoption > label')) return;
    this.collapse();
    this.handleCollapse();
  }

  handleExpand() {
    if (this._highlight == null) {
      /* should never happen */
      console.warn('Null _highlight on expand');
      this.handleCollapse();
    }
    /* scroll to the highlighted element (must be visible) */
    const highlight = this._options[this._highlight];
    //this._datalist.scrollTop = highlight.offsetTop - (this._el.offsetHeight - highlight.getBoundingClientRect().height) / 2;
    highlight.scrollIntoView({'block': 'center'});
  }

  handleCollapse() {
    /* reset the highlight to the current value */
    this.setHighlight(this._index, false);
  }

  [Symbol.toStringTag] = 'Dropdown';
}
