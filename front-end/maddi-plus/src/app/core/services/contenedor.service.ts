import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BusquedaParams, ContenedorGeoJSON, IncidenciasGeoJSON, PortalesGeoJSON, ViviendaRecord } from '../models/contenedor.model';

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

  getViviendas(portalId: number): Observable<ViviendaRecord[]> {
    return this.http.get<ViviendaRecord[]>(`${this.url}/portales/${portalId}/viviendas`);
  }

  getDetalles(matricula: number): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.url}/detalles/${matricula}`);
  }

  buscarContenedores(params: BusquedaParams): Observable<ContenedorGeoJSON> {
    return this.http.get<ContenedorGeoJSON>(`${this.url}/buscar`, {
      params: new HttpParams({ fromObject: params as Record<string, string> }),
    });
  }

  getIncidencias(): Observable<IncidenciasGeoJSON> {
    return this.http.get<IncidenciasGeoJSON>(`${this.url}/incidencias`);
  }
}
