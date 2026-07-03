import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Ruta, RutaParada, OsrmRouteGeometry } from '../models/ruta.model';

interface OsrmResponse {
  code: string;
  routes: Array<{ geometry: OsrmRouteGeometry; distance: number; duration: number }>;
}

@Injectable({ providedIn: 'root' })
export class RutaService {
  private readonly url = `${environment.apiUrl}/rutas`;
  private readonly osrmBase = 'https://router.project-osrm.org/route/v1/driving';

  constructor(private http: HttpClient) {}

  /** Devuelve todas las rutas agrupadas por id_parada, con el nombre de nombres_ruta. */
  getRutas(): Observable<Ruta[]> {
    return this.http.get<RutaParada[]>(this.url).pipe(
      map((paradas) => {
        const mapa = new Map<string, Ruta>();
        for (const parada of paradas) {
          const id = parada.id_parada ?? 'sin-id';
          if (!mapa.has(id)) {
            mapa.set(id, {
              id,
              nombre: parada.nombre_ruta ?? id,
              paradas: [],
            });
          }
          mapa.get(id)!.paradas.push(parada);
        }
        return Array.from(mapa.values()).map((ruta) => ({
          ...ruta,
          paradas: ruta.paradas
            .filter((p) => p.numero_paradas != null)
            .sort((a, b) => Number(a.numero_paradas) - Number(b.numero_paradas)),
        }));
      }),
    );
  }

  /**
   * Obtiene la geometría del trayecto real por carreteras usando OSRM.
   * Las coordenadas en la BD siguen la convención del proyecto: x=latitud, y=longitud.
   * OSRM espera "longitud,latitud" por waypoint.
   * En caso de error, devuelve una línea recta entre las paradas como fallback.
   */
  getRouteGeometry(paradas: RutaParada[]): Observable<OsrmRouteGeometry> {
    const valid = paradas
      .filter((p) => p.x != null && p.y != null && p.numero_paradas != null)
      .sort((a, b) => Number(a.numero_paradas) - Number(b.numero_paradas));

    if (valid.length < 2) {
      return of({ type: 'LineString', coordinates: [] } as OsrmRouteGeometry);
    }

    const fallback: OsrmRouteGeometry = {
      type: 'LineString',
      coordinates: valid.map((p) => [p.y as number, p.x as number]),
    };

    // OSRM limita a 100 waypoints en la instancia pública
    const MAX_WAYPOINTS = 100;
    const waypoints = valid.slice(0, MAX_WAYPOINTS);
    const coords = waypoints.map((p) => `${p.y},${p.x}`).join(';');
    const url = `${this.osrmBase}/${coords}?overview=full&geometries=geojson`;

    return this.http.get<OsrmResponse>(url).pipe(
      map((res) => {
        if (res.code !== 'Ok' || !res.routes.length) return fallback;
        return res.routes[0].geometry;
      }),
      catchError(() => of(fallback)),
    );
  }
}
