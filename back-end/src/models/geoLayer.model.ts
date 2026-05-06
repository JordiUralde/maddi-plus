export interface GeoLayerDto {
  name: string;
  title: string;
  wmsUrl: string;
  zIndex: number;
  /** [minX, minY, maxX, maxY] en EPSG:4326 */
  bbox?: [number, number, number, number];
}
