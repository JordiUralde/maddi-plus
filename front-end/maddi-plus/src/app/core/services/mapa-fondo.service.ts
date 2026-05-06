import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MapaFondo } from '../models/mapa-fondo.model';

@Injectable({
  providedIn: 'root',
})
export class MapaFondoService {
  private readonly url = `${environment.apiUrl}/mapas-fondo`;

  constructor(private http: HttpClient) {}

  getMapasFondo(): Observable<MapaFondo[]> {
    return this.http.get<MapaFondo[]>(this.url);
  }
}
