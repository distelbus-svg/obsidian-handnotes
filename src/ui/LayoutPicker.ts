import { LayoutType } from '../types';

export class LayoutPicker {
  private container: HTMLElement;
  private currentLayout: LayoutType = 'blank';
  private onLayoutChange: (layout: LayoutType) => void;

  constructor(
    container: HTMLElement,
    onChange: (layout: LayoutType) => void
  ) {
    this.container = container;
    this.onLayoutChange = onChange;
    this.build();
  }

  private build(): void {
    this.container.addClass('handnotes-layout-picker');

    const layouts: { value: LayoutType; label: string; icon: string }[] = [
      { value: 'blank', label: 'Blank', icon: '⊞' },
      { value: 'ruled-narrow', label: 'Ruled (narrow)', icon: '≡' },
      { value: 'ruled-wide', label: 'Ruled (wide)', icon: '☰' },
      { value: 'grid-small', label: 'Grid (small)', icon: '▦' },
      { value: 'grid-large', label: 'Grid (large)', icon: '▤' },
      { value: 'dot', label: 'Dot grid', icon: '⋯' },
      { value: 'isometric', label: 'Isometric', icon: '⬡' },
    ];

    const select = this.container.createEl('select', {
      cls: 'handnotes-layout-select',
    });

    for (const layout of layouts) {
      const option = select.createEl('option', {
        value: layout.value,
        text: `${layout.icon} ${layout.label}`,
      });
      if (layout.value === this.currentLayout) {
        option.selected = true;
      }
    }

    select.addEventListener('change', () => {
      this.currentLayout = select.value as LayoutType;
      this.onLayoutChange(this.currentLayout);
    });
  }

  setLayout(layout: LayoutType): void {
    this.currentLayout = layout;
    const select = this.container.querySelector('select');
    if (select) {
      (select as HTMLSelectElement).value = layout;
    }
  }

  getLayout(): LayoutType {
    return this.currentLayout;
  }
}
