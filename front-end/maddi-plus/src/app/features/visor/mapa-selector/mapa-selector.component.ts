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
import { MapaFondo } from '../../../core/models/mapa-fondo.model';

@Component({
  selector: 'app-mapa-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa-selector.component.html',
  styleUrl: './mapa-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapaSelectorComponent {
  @Input() mapasFondo: MapaFondo[] = [];
  @Input() mapaActivo: MapaFondo | null = null;
  @Output() mapaSeleccionado = new EventEmitter<MapaFondo>();

  abierto = false;

  constructor(private elRef: ElementRef) {}

  togglePanel(): void {
    this.abierto = !this.abierto;
  }

  seleccionar(mapa: MapaFondo): void {
    this.mapaSeleccionado.emit(mapa);
    this.abierto = false;
  }

  @HostListener('document:click', ['$event.target'])
  onClickFuera(target: HTMLElement): void {
    if (this.abierto && !this.elRef.nativeElement.contains(target)) {
      this.abierto = false;
    }
  }
}
