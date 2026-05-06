import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GeoLayer } from '../models/geo-layer.model';

@Injectable({
  providedIn: 'root',
})
export class GeoLayerService {
  private readonly url = `${environment.apiUrl}/capas`;

  constructor(private http: HttpClient) {}

  getCapas(): Observable<GeoLayer[]> {
    return this.http.get<GeoLayer[]>(this.url);
  }
}
