import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViviendaRecord } from '../../../core/models/contenedor.model';

@Component({
  selector: 'app-vivienda-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vivienda-info.component.html',
  styleUrl: './vivienda-info.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViviendaInfoComponent {
  @Input() viviendas: ViviendaRecord[] = [];
  @Input() cargando = false;
  @Input() portalProps: Record<string, unknown> | null = null;

  @Output() cerrado = new EventEmitter<void>();

  private readonly camposVisibles: { key: string; label: string }[] = [
    { key: '45_car', label: 'id' },
    { key: '31_pc', label: 'Referencia catastral' },
  ];

  propiedades(record: Record<string, unknown>): Array<{ k: string; v: string }> {
    return this.camposVisibles
      .filter(({ key }) => record[key] !== null && record[key] !== undefined && record[key] !== '')
      .map(({ key, label }) => ({ k: label, v: String(record[key]) }));
  }

  portalTitulo(): string {
    if (!this.portalProps) return 'Viviendas';
    const calle = this.portalProps['calle'];
    const numero = this.portalProps['numero'];
    if (calle && numero) return `${calle}, ${numero}`;
    if (calle) return String(calle);
    if (numero) return String(numero);
    return 'Viviendas del portal';
  }
}
