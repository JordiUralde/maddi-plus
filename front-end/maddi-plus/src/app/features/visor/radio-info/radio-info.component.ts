import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContenedorInfo, PortalFeature } from '../../../core/models/contenedor.model';

@Component({
  selector: 'app-radio-info',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './radio-info.component.html',
  styleUrl: './radio-info.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadioInfoComponent {
  private _radio = 100;
  radioTemp = 100;

  @Input() set radio(val: number) {
    this._radio = val;
    this.radioTemp = val;
  }
  get radio(): number {
    return this._radio;
  }

  @Input() portales: PortalFeature[] = [];
  @Input() contenedor: ContenedorInfo | null = null;
  @Input() cargando = false;

  /** Se emite en cada movimiento del slider (actualiza el círculo en tiempo real) */
  @Output() radioCirculoCambiado = new EventEmitter<number>();
  /** Se emite al soltar el slider (lanza la llamada a la API) */
  @Output() radioCambiado = new EventEmitter<number>();
  @Output() cerrado = new EventEmitter<void>();

  onSliderInput(): void {
    this.radioCirculoCambiado.emit(this.radioTemp);
  }

  onSliderChange(): void {
    this.radioCambiado.emit(this.radioTemp);
  }

  colorFraccion(fraccion: string | undefined): string {
    switch (fraccion) {
      case 'Papel/Cartón': return '#1565C0';
      case 'Orgánico':     return '#6D4C41';
      case 'Envases':      return '#F9A825';
      default:             return '#757575';
    }
  }

  propiedades(props: Record<string, unknown>): Array<{ k: string; v: string }> {
    return Object.entries(props)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => ({ k, v: String(v) }));
  }
}
