import {
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeoLayer } from '../../../core/models/geo-layer.model';

export interface CapaEstado {
  capa: GeoLayer;
  visible: boolean;
}

@Component({
  selector: 'app-capa-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './capa-selector.component.html',
  styleUrl: './capa-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapaSelectorComponent {
  @Input() capas: CapaEstado[] = [];
  @Output() visibilidadCambiada = new EventEmitter<CapaEstado>();

  abierto = false;

  constructor(private elRef: ElementRef) {}

  togglePanel(): void {
    this.abierto = !this.abierto;
  }

  toggleCapa(estado: CapaEstado): void {
    const nuevo: CapaEstado = { ...estado, visible: !estado.visible };
    this.visibilidadCambiada.emit(nuevo);
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
