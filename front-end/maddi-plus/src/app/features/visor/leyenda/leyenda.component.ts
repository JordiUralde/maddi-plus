import {
  Component,
  Input,
  HostListener,
  ElementRef,
  ChangeDetectionStrategy,
  OnChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CapaEstado } from '../capa-selector/capa-selector.component';

@Component({
  selector: 'app-leyenda',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leyenda.component.html',
  styleUrl: './leyenda.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeyendaComponent implements OnChanges {
  @Input() capas: CapaEstado[] = [];

  abierto = false;
  capasVisibles: CapaEstado[] = [];

  constructor(private elRef: ElementRef) {}

  ngOnChanges(): void {
    this.capasVisibles = this.capas.filter(
      (c) => c.visible && !c.capa.name.toLowerCase().includes('portales'),
    );
  }

  togglePanel(): void {
    this.abierto = !this.abierto;
  }

  getLegendUrl(estado: CapaEstado): string {
    const base = estado.capa.wmsUrl;
    const separator = base.includes('?') ? '&' : '?';
    return (
      `${base}${separator}` +
      `SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic` +
      `&FORMAT=image%2Fpng&LAYER=${encodeURIComponent(estado.capa.name)}` +
      `&legend_options=fontAntiAliasing:true;dpi:96;fontName:Arial`
    );
  }

  trackByCapa(_: number, item: CapaEstado): string {
    return item.capa.name;
  }

  @HostListener('document:click', ['$event.target'])
  onClickFuera(target: HTMLElement): void {
    if (this.abierto && !this.elRef.nativeElement.contains(target)) {
      this.abierto = false;
    }
  }
}
