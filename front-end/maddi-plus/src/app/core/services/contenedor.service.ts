import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BusquedaParams, ContenedorGeoJSON, PortalesGeoJSON } from '../models/contenedor.model';

@Injectable({
  providedIn: 'root',
})
export class ContenedorService {
  private readonly url = `${environment.apiUrl}/contenedores`;

  constructor(private http: HttpClient) {}

  getContenedores(): Observable<ContenedorGeoJSON> {
    return this.http.get<ContenedorGeoJSON>(this.url);
  }

  getPortales(lon: number, lat: number, radio: number): Observable<PortalesGeoJSON> {
    return this.http.get<PortalesGeoJSON>(
      `${this.url}/portales/${lon}/${lat}?radio=${radio}`
    );
  }

  buscarContenedores(params: BusquedaParams): Observable<ContenedorGeoJSON> {
    return this.http.get<ContenedorGeoJSON>(`${this.url}/buscar`, {
      params: new HttpParams({ fromObject: params as Record<string, string> }),
    });
  }
}
